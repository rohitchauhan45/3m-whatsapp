import logger from "../../libraries/log/logger";
import { prisma } from "../../libraries/db";
import { AppError } from "../../libraries/error-handling/AppError";
import { AcceptStatus } from "@prisma/client";
import { sendWhatsAppButtons } from "domains/whtsapp/sendWhatsApp";

export const sendPunchInButton = async () => {
    try {
        const users = await prisma.user.findMany({
            where: {
                Dailytask: {
                    some: {
                        status: AcceptStatus.accept,
                        date: new Date()
                    }
                }
            }
        })

        if (!users) {
            return {
                success: false,
                status: 404,
                message: "users not found",
                sent: 0,
                skippedNoPhone: 0,
                skippedNoTasks: 0,
                failedSends: 0,
                managerSummarySent: false,
            };
        }

        let sent = 0;
        let skippedNoPhone = 0;
        let failedSends = 0;
        let managerSummarySent = false;

        for (const user of users) {
            const number = user.number

            if (!number) {
                skippedNoPhone++
                continue
            }

            const result = await sendWhatsAppButtons({ number: number, message: "Please punch in before starting task ", buttons: [{ title: `Punch in`, id: `punchin_${user.id}` }] })

            if (result.success) {
                sent++
            } else {
                failedSends++
            }
        }
    } catch (error) {
        logger.error(`Error in send punch in button to user`, error)
        throw new AppError(`Error in send punch in button to user`, error.message)
    }
}