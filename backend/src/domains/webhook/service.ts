import {
    handleDeclineReason,
    handleFinalDecisionAbsentReason,
    handleFinalDecisionRemarkReason,
    handleFollowUp,
    handleFollowUpReply,
    handlePhotoUploadChoice,
    handleIncomingTaskPhoto,
    handleMenuButton,
    handleMenuText,
    handlePendigTaskUpdateText,
    handlePreviousTaskFollowupStatus,
    handleStartTaskDelayTime,
    handleStarttaskStatus,
    updateFinalDecision,
    updateTaskAcceptFromWhatsApp,
} from "../Task/service";
import logger from "../../libraries/log/logger";
import dotenv from "dotenv";
import { attendence } from "../attendence/service";
import { prisma } from "../../libraries/db";
import { sendMessageOnWhatsapp, normalizeWhatsAppNumber } from "../../domains/whtsapp/sendWhatsApp";
import { touchConversation } from "../../domains/conversation/service";
import {
    applyWhatsAppStatusUpdate,
    saveIncomingMessage,
} from "../../domains/whtsapp/messageLog";
import { MessageStyle } from "@prisma/client";
import { notifyDashboardUpdate } from "../../libraries/realtime";
import { notifyAdminError } from "../../libraries/util/notifyAdminError";

dotenv.config();

const VERIFY_WEBHOOK_TOKEN = process.env.VERIFY_WEBHOOK_TOKEN

const processedMessageIds = new Set<string>();

function rememberMessageId(messageId: string): boolean {
    if (!messageId) return true;
    if (processedMessageIds.has(messageId)) return false;
    processedMessageIds.add(messageId);
    if (processedMessageIds.size > 500) {
        const first = processedMessageIds.values().next().value;
        if (first) processedMessageIds.delete(first);
    }
    return true;
}

function isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseCoordinate(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function parseButtonPayload(payload: string): { action: string; id: string } | null {
    const trimmed = payload.trim();
    if (!trimmed) return null;

    const sep = trimmed.indexOf("_");
    if (sep < 0) {
        return { action: trimmed.toLowerCase(), id: "" };
    }
    if (sep === 0) return null;

    return {
        action: trimmed.slice(0, sep).toLowerCase(),
        id: trimmed.slice(sep + 1),
    };
}

/** Template quick-reply uses type `button`; interactive messages use `interactive.button_reply`. */
function extractButtonPayload(msg: Record<string, unknown>, type: string): string | null {
    if (type === "button" && isRecord(msg.button)) {
        const payload = msg.button.payload;
        if (typeof payload === "string" && payload.trim()) return payload;

        const text = msg.button.text;
        return typeof text === "string" && text.trim() ? text : null;
    }

    if (type === "interactive" && isRecord(msg.interactive)) {
        const interactive = msg.interactive;
        if (interactive.type === "button_reply" && isRecord(interactive.button_reply)) {
            const id = interactive.button_reply.id;
            return typeof id === "string" ? id : null;
        }
    }

    return null;
}

function readString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function joinLines(lines: string[]): string {
    return lines.filter(Boolean).join("\n");
}

/** Human-readable body + style for storing an incoming Meta message. */
function describeIncomingMessage(
    msg: Record<string, unknown>,
    type: string,
): { style: MessageStyle; body: string } {
    if (type === "text" && isRecord(msg.text)) {
        return { style: MessageStyle.TEXT, body: readString(msg.text.body) };
    }

    if (type === "button" && isRecord(msg.button)) {
        const text = readString(msg.button.text);
        const payload = readString(msg.button.payload);
        return {
            style: MessageStyle.INTERACTIVE,
            body: joinLines([
                text ? `Button: ${text}` : "",
                payload && payload !== text ? `Payload: ${payload}` : "",
            ]),
        };
    }

    if (type === "interactive" && isRecord(msg.interactive)) {
        const interactive = msg.interactive;
        const reply = isRecord(interactive.button_reply)
            ? interactive.button_reply
            : isRecord(interactive.list_reply)
              ? interactive.list_reply
              : null;
        const label = interactive.type === "list_reply" ? "List reply" : "Button";
        return {
            style: MessageStyle.INTERACTIVE,
            body: reply
                ? joinLines([
                      readString(reply.title) ? `${label}: ${readString(reply.title)}` : "",
                      readString(reply.description)
                          ? `Description: ${readString(reply.description)}`
                          : "",
                      readString(reply.id) ? `Payload: ${readString(reply.id)}` : "",
                  ])
                : `Interactive: ${readString(interactive.type) || "unknown"}`,
        };
    }

    if (type === "location" && isRecord(msg.location)) {
        const loc = msg.location;
        const latitude = parseCoordinate(loc.latitude);
        const longitude = parseCoordinate(loc.longitude);
        return {
            style: MessageStyle.TEXT,
            body: joinLines([
                latitude !== null && longitude !== null
                    ? `Location: ${latitude}, ${longitude}`
                    : "Location",
                readString(loc.name) ? `Name: ${readString(loc.name)}` : "",
                readString(loc.address) ? `Address: ${readString(loc.address)}` : "",
            ]),
        };
    }

    if (
        (type === "image" ||
            type === "video" ||
            type === "audio" ||
            type === "document" ||
            type === "sticker") &&
        isRecord(msg[type])
    ) {
        const media = msg[type] as Record<string, unknown>;
        return {
            style: MessageStyle.TEXT,
            body: joinLines([
                `${type.charAt(0).toUpperCase()}${type.slice(1)}`,
                readString(media.filename) ? `File: ${readString(media.filename)}` : "",
                readString(media.caption) ? `Caption: ${readString(media.caption)}` : "",
                readString(media.mime_type) ? `Mime: ${readString(media.mime_type)}` : "",
                readString(media.id) ? `Media ID: ${readString(media.id)}` : "",
            ]),
        };
    }

    if (type === "reaction" && isRecord(msg.reaction)) {
        const emoji = readString(msg.reaction.emoji);
        return {
            style: MessageStyle.TEXT,
            body: emoji ? `Reaction: ${emoji}` : "Reaction removed",
        };
    }

    if (type === "contacts" && Array.isArray(msg.contacts)) {
        const names = msg.contacts
            .map((c) => (isRecord(c) && isRecord(c.name) ? readString(c.name.formatted_name) : ""))
            .filter(Boolean);
        return {
            style: MessageStyle.TEXT,
            body: names.length ? `Contacts: ${names.join(", ")}` : "Contacts",
        };
    }

    return { style: MessageStyle.TEXT, body: `Unsupported message type: ${type}` };
}

async function findUserByWhatsAppNumber(from: string) {
    const normalized = normalizeWhatsAppNumber(from);
    if (!normalized) return null;

    return prisma.user.findFirst({
        where: {
            deletedAt: null,
            number: normalized,
        },
    });
}

async function handleButtonAction(
    storedNumber: string,
    userId: string,
    action: string,
    id: string,
): Promise<void> {
    await touchConversation(userId, storedNumber);

    // manager_reminder template quick-reply (payload: "hii")
    if (action === "hii" || action === "hi") {
        logger.info(`webhook manager reminder acknowledged userId=${userId} number=${storedNumber}`);
        return;
    }

    if (action === "accept" || action === "decline") {
        await updateTaskAcceptFromWhatsApp(id, storedNumber, action);
        return;
    }

    if (action === "start" || action === "taskquery" || action === "delay") {
        await handleStarttaskStatus(id, storedNumber, action);
        return;
    }

    if (action === "inphourly" || action === "inpendtime" || action === "remark" || action === "done") {
        await handleFollowUp(id, storedNumber, action);
        return;
    }

    if (action === "ontrack" || action === "no") {
        await updateFinalDecision(id, storedNumber, action);
        return;
    }

    if (action === "menu") {
        await handleMenuButton(storedNumber, id);
        return;
    }

    if (action === "cpyes" || action === "cpno" || action === "rpyes" || action === "rpno") {
        const mode = action.startsWith("cp") ? "completed" : "remark";
        const choice = action.endsWith("yes") ? "yes" : "no";
        await handlePhotoUploadChoice(storedNumber, choice, id, mode);
        return;
    }

    if (action === "blocked" || action === "completed" || action === "hold") {
        await handlePreviousTaskFollowupStatus(id, storedNumber, action);
    }
}

export const verifyWebhookQuery = (mode: string, token: string, challenge: string) => {
    if (
        mode === "subscribe" && token === VERIFY_WEBHOOK_TOKEN && challenge && challenge.length > 0
    ) {
        logger.info("webhook Meta verification OK");
        return { success: true, status: 200, challenge };
    }
    return { success: false, status: 403 };
};

async function handleIncomingMessage(msg: Record<string, unknown>): Promise<void> {
    const messageId = typeof msg.id === "string" ? msg.id : "";
    if (messageId && !rememberMessageId(messageId)) return;

    const from = typeof msg.from === "string" ? msg.from : "";
    const type = typeof msg.type === "string" ? msg.type : "";
    if (!from || !type) return;

    const user = await findUserByWhatsAppNumber(from);

    if (!user) {
        await sendMessageOnWhatsapp({
            number: from,
            message: "You are not user in this app please contact Admin or manager",
            type: "unauthorizedUser",
        })
        return
    }

    const incoming = describeIncomingMessage(msg, type);
    const savedIncoming = await saveIncomingMessage({
        userId: user.id,
        number: user.number,
        whatsappMessageId: messageId,
        type,
        style: incoming.style,
        body: incoming.body,
        timestamp:
            typeof msg.timestamp === "string" || typeof msg.timestamp === "number"
                ? msg.timestamp
                : null,
    });
    // Meta re-delivered a message we already stored (and processed) — do not re-run actions.
    if (savedIncoming.duplicate) return;

    const buttonPayload = extractButtonPayload(msg, type);
    if (buttonPayload) {
        const parsed = parseButtonPayload(buttonPayload);
        if (!parsed) {
            logger.warn(`webhook unparseable button payload from=${from} payload=${buttonPayload}`);
            return;
        }
        logger.info(`webhook button from=${from} action=${parsed.action} id=${parsed.id || "(none)"}`);
        await handleButtonAction(user.number, user.id, parsed.action, parsed.id);
        return;
    }

    if (type === "text" && isRecord(msg.text)) {
        await touchConversation(user.id, user.number)

        const textBody = typeof msg.text.body === "string" ? msg.text.body.trim() : "";
        if (!textBody) return;

        logger.info(`incoming msg from = ${from} message = ${textBody}`);

        if (textBody.toLowerCase() === "menu") {
            await handleMenuText(user.number);
            return;
        }

        if (textBody.toLowerCase() === "update") {
            await handlePendigTaskUpdateText(user.number);
            return;
        }

        const declineSaved = await handleDeclineReason(user.number, textBody);
        if (declineSaved) return;

        const finalRemarkSaved = await handleFinalDecisionRemarkReason(user.number, textBody);
        if (finalRemarkSaved) return;

        const startTaskdelay = await handleStartTaskDelayTime(user.number, textBody);
        if (startTaskdelay) return;

        const followUpSaved = await handleFollowUpReply(user.number, textBody);
        if (followUpSaved) return;

        const finalAbsentSaved = await handleFinalDecisionAbsentReason(user.number, textBody);
        if (finalAbsentSaved) return;

        return;
    }

    if (type === "image" && isRecord(msg.image)) {
        await touchConversation(user.id, user.number);

        const mediaId = typeof msg.image.id === "string" ? msg.image.id : "";
        const mimeType =
            typeof msg.image.mime_type === "string" ? msg.image.mime_type : "image/jpeg";

        if (mediaId) {
            await handleIncomingTaskPhoto(user.number, mediaId, mimeType);
        }
        return;
    }

    if (type === "location" && isRecord(msg.location)) {

        await touchConversation(user.id, user.number)

        const latitude = parseCoordinate(msg.location.latitude);
        const longitude = parseCoordinate(msg.location.longitude);

        if (latitude === null || longitude === null) {
            logger.warn(`webhook invalid location payload from=${from}`);
            return;
        }

        logger.info(`webhook location from=${from} lat=${latitude} long=${longitude}`);

        try {
            await attendence(user.number, latitude, longitude);
        } catch (err) {
            logger.error(`webhook attendance failed from=${from}`, err);
            await notifyAdminError("webhook attendance");
        }
        return;
    }
}

async function handleOutgoingStatuses(statuses: unknown): Promise<void> {
    if (!Array.isArray(statuses)) return;

    for (const item of statuses) {
        if (!isRecord(item)) continue;

        const id = typeof item.id === "string" ? item.id : "";
        const status = typeof item.status === "string" ? item.status : "";
        if (!id || !status) continue;

        await applyWhatsAppStatusUpdate({
            whatsappMessageId: id,
            status,
            timestamp: typeof item.timestamp === "string" || typeof item.timestamp === "number"
                ? item.timestamp
                : undefined,
            errors: item.errors,
        });
    }
}

/** Meta WhatsApp webhook POST body. */
export async function handleWebhook(body: unknown): Promise<void> {
    if (!isRecord(body) || !Array.isArray(body.entry)) {
        return;
    }

    let messageCount = 0;

    for (const entry of body.entry) {
        if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;

        for (const ch of entry.changes) {
            if (!isRecord(ch) || !isRecord(ch.value)) continue;

            const data = ch.value;

            // Delivery receipts: sent / delivered / read / failed
            if (Array.isArray(data.statuses)) {
                await handleOutgoingStatuses(data.statuses);
            }

            const messages = data.messages;
            if (!Array.isArray(messages)) continue;

            for (const msg of messages) {
                if (!isRecord(msg)) continue;
                messageCount += 1;
                await handleIncomingMessage(msg);
            }
        }
    }

    if (messageCount > 0) {
        notifyDashboardUpdate();
    }
}