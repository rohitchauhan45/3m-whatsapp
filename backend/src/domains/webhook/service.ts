import {
    handleDeclineReason,
    handleFinalDecisionRemarkReason,
    handleFollowUp,
    handleFollowUpReply,
    handleStarttaskStatus,
    updateFinalDecision,
    updateTaskAcceptFromWhatsApp,
} from "../Task/service";
import logger from "../../libraries/log/logger";
import dotenv from "dotenv";

dotenv.config();

const VERIFY_WEBHOOK_TOKEN = process.env.VERIFY_WEBHOOK_TOKEN ?? process.env.VERFIRY_WEBHOOK_TOKEN;

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

/** Meta GET verify: compare token and return challenge on success. */
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

    if (type === "text" && isRecord(msg.text)) {
        const textBody = typeof msg.text.body === "string" ? msg.text.body.trim() : "";
        if (!textBody) return;
        logger.info(`incoming msg from = ${from} message = ${textBody}`);

        const declineSaved = await handleDeclineReason(from, textBody);
        if (declineSaved) return;

        const finalRemarkSaved = await handleFinalDecisionRemarkReason(from, textBody);
        if (finalRemarkSaved) return;

        const followUpSaved = await handleFollowUpReply(from, textBody);
        if (followUpSaved) return;
        return;
    }

    if (type !== "interactive" || !isRecord(msg.interactive)) return;

    const interactive = msg.interactive;
    if (interactive.type !== "button_reply" || !isRecord(interactive.button_reply)) return;

    const buttonId =
        typeof interactive.button_reply.id === "string"
            ? interactive.button_reply.id.toLowerCase().trim()
            : "";

    const [action, id] = buttonId.split("_")
    logger.info(`webhook incoming from=${from} message=${action}`);

    if (action === "accept" || action === "decline") {
        await updateTaskAcceptFromWhatsApp(id, from, action);
    }

    if (action === "start" || action === "taskquery") {
        await handleStarttaskStatus(id, from, action)
    }

    if (action === "inprogress" || action === "remark" || action === "done") {
        await handleFollowUp(id, from, action)
    }

    if (action === "ontrack" || action === "no") {
        await updateFinalDecision(id, from, action)
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

}
