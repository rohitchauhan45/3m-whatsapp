import { prisma } from "../db";
import logger from "../log/logger";
import { clampWhatsAppBody } from "../../domains/messages/whatsappBodyLimit";
import {
    sanitizeWhatsAppTemplateParam,
    sendMessageOnWhatsapp,
    sendWhatsappTemplate,
} from "../../domains/whtsapp/sendWhatsApp";

const DEVELOPER_ERROR_TEMPLATE = "developer_error";
const MAX_ERROR_NAME_LEN = 1024;

let adminPromise: ReturnType<
    typeof prisma.user.findFirst<{ select: { number: true } }>
> | null = null;

function getAdminUser() {
    adminPromise ??= prisma.user.findFirst({
        where: { role: "admin", deletedAt: null },
        select: { number: true },
    });
    return adminPromise;
}

/** Notify admin via WhatsApp when a backend error occurs. Safe to call from catch blocks. */
export async function notifyAdminError(context: string): Promise<void> {
    try {
        const adminUser = await getAdminUser();
        if (!adminUser?.number?.trim()) {
            logger.warn(`notifyAdminError: admin phone not found (context="${context}")`);
            return;
        }

        const errorName = sanitizeWhatsAppTemplateParam(
            `${context}`,
        ).slice(0, MAX_ERROR_NAME_LEN);

        const result = await sendWhatsappTemplate({
            number: adminUser.number,
            tname: DEVELOPER_ERROR_TEMPLATE,
            type: "errorInBackend",
            parameters: [{ parameter_name: "error_name", text: errorName }],
        });

        if (!result.success) {
            logger.warn(
                `notifyAdminError template failed (context="${context}") detail=${result.message}`,
            );
        }
    } catch (notifyErr) {
        logger.error(`notifyAdminError failed (context="${context}")`, notifyErr);
    }
}

/** Notify admin via WhatsApp with an informational message (e.g. import success summary). */
export async function notifyAdminMessage(
    message: string,
    type: string = "errorInBackend",
): Promise<void> {
    try {
        const adminUser = await getAdminUser();
        if (!adminUser?.number?.trim()) {
            logger.warn("notifyAdminMessage: admin phone not found");
            return;
        }
        await sendMessageOnWhatsapp({
            number: adminUser.number,
            message: clampWhatsAppBody(message),
            type,
        });
    } catch (notifyErr) {
        logger.error("notifyAdminMessage failed", notifyErr);
    }
}

/** Notify admin when a first-message WhatsApp send fails (Meta reject / delivery fail). Body ≤ 1024. */
export async function notifyAdminWhatsAppFailure(opts: {
    type: string;
    number: string;
    errorCode?: string | null;
    errorTitle?: string | null;
    errorDetails?: string | null;
    dailyTaskId?: string | null;
    taskId?: string | null;
}): Promise<void> {
    const lines = [
        "WhatsApp send FAILED",
        `type: ${opts.type}`,
        `to: ${opts.number}`,
        opts.dailyTaskId ? `dailyTaskId: ${opts.dailyTaskId}` : null,
        opts.taskId ? `taskId: ${opts.taskId}` : null,
        opts.errorCode ? `code: ${opts.errorCode}` : null,
        opts.errorTitle ? `title: ${opts.errorTitle}` : null,
        opts.errorDetails ? `details: ${opts.errorDetails}` : null,
        "Fix the cause — will not retry automatically.",
    ].filter(Boolean) as string[];

    await notifyAdminMessage(lines.join("\n"), "whatsappSendFailed");
}
