import {
    handleDeclineReason,
    handleFinalDecisionAbsentReason,
    handleFinalDecisionRemarkReason,
    handleFollowUp,
    handleFollowUpReply,
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
import { sendMessageOnWhatsapp } from "../../domains/whtsapp/sendWhatsApp";
import { touchConversation } from "../../domains/conversation/service";
import { notifyDashboardUpdate } from "../../libraries/realtime";
import { notifyAdminError } from "../../libraries/util/notifyAdminError";
import { numberLookupVariants } from "../../libraries/util/Task/number";

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

async function findUserByWhatsAppNumber(from: string) {
    const variants = numberLookupVariants(from);
    return prisma.user.findFirst({
        where: {
            deletedAt: null,
            number: { in: variants.length > 0 ? variants : [from] },
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

    if (action === "inprogress" || action === "remark" || action === "done") {
        await handleFollowUp(id, storedNumber, action);
        return;
    }

    if (action === "ontrack" || action === "no") {
        await updateFinalDecision(id, storedNumber, action);
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
        await sendMessageOnWhatsapp({ number: from, message: "You are not user in this app please contact Admin or manager" })
        return
    }

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

        if (textBody.toLowerCase() === "update") {
            await handlePendigTaskUpdateText(from);
            return;
        }
        
        const declineSaved = await handleDeclineReason(from, textBody);
        if (declineSaved) return;

        const finalRemarkSaved = await handleFinalDecisionRemarkReason(from, textBody);
        if (finalRemarkSaved) return;

        const startTaskdelay = await handleStartTaskDelayTime(from, textBody)
        if (startTaskdelay) return

        const followUpSaved = await handleFollowUpReply(from, textBody);
        if (followUpSaved) return;

        const finalAbsentSaved = await handleFinalDecisionAbsentReason(from, textBody)
        if (finalAbsentSaved) return;

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
            await attendence(from, latitude, longitude);
        } catch (err) {
            logger.error(`webhook attendance failed from=${from}`, err);
            await notifyAdminError("webhook attendance");
        }
        return;
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