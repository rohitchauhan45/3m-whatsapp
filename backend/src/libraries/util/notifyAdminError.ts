import { prisma } from "../db";
import logger from "../log/logger";
import { sendMessageOnWhatsapp } from "../../domains/whtsapp/sendWhatsApp";

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
        await sendMessageOnWhatsapp({
            number: adminUser.number,
            message: `💀 Error in ${context}, please check logs/code`,
        });
    } catch (notifyErr) {
        logger.error(`notifyAdminError failed (context="${context}")`, notifyErr);
    }
}
