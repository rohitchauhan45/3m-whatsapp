import { prisma } from "../../libraries/db";
import logger from "../../libraries/log/logger";
import { AppError } from "../../libraries/error-handling/AppError";
import { notifyAdminError } from "../../libraries/util/notifyAdminError";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const touchConversation = async (userId: string, number: string) => {
    try {

        const now = new Date();

        return await prisma.whatsAppConversation.upsert({
            where: {
                userId,
            },
            update: {
                lastIncomingAt: now,
                windowExpiresAt: new Date(now.getTime() + DAY_IN_MS),
            },
            create: {
                userId,
                number,
                lastIncomingAt: now,
                windowExpiresAt: new Date(now.getTime() + DAY_IN_MS),
            },
        });

    } catch (error) {
        logger.error("Error in Add whatsapp Conversation", error)
        await notifyAdminError("add whatsapp conversation");
        throw new AppError("Error in add whatsapp Conversation , Internal server Error", error.message)
    }
}