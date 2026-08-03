import { prisma } from "../db";
import logger from "../log/logger";
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
export async function notifyAdminMessage(message: string): Promise<void> {
    try {
        const adminUser = await getAdminUser();
        if (!adminUser?.number?.trim()) {
            logger.warn("notifyAdminMessage: admin phone not found");
            return;
        }
        await sendMessageOnWhatsapp({
            number: adminUser.number,
            message,
        });
    } catch (notifyErr) {
        logger.error("notifyAdminMessage failed", notifyErr);
    }
}
