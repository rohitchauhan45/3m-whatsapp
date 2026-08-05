import { Role } from "@prisma/client";
import { prisma } from "../../../libraries/db";
import logger from "../../../libraries/log/logger";
import { notifyAdminError, notifyAdminMessage } from "../../../libraries/util/notifyAdminError";
import { formatCalendarDateLabel, getISTTodayCalendarDate } from "../../../libraries/util/Task/istDate";
import { sendMessageOnWhatsapp } from "../../whtsapp/sendWhatsApp";
import {
    formatEndOfDayAdminSummaryMessage,
    formatEndOfDayManagerSummaryMessage,
} from "../../messages/endOfDaySummaryMessage";
import { taskCardDetails, userCardDetails } from "./service";

export type EndOfDaySummaryResult = {
    success: boolean;
    message: string;
    managersSent: number;
    managersFailed: number;
    managersSkippedNoPhone: number;
    adminSent: boolean;
};

export async function sendEndOfDaySummaries(): Promise<EndOfDaySummaryResult> {
    const dateLabel = formatCalendarDateLabel(getISTTodayCalendarDate());

    const [allUserCards, allTaskCards, managers] = await Promise.all([
        userCardDetails("today"),
        taskCardDetails("today"),
        prisma.user.findMany({
            where: { role: Role.manager, deletedAt: null },
            select: { id: true, name: true, number: true },
        }),
    ]);

    let managersSent = 0;
    let managersFailed = 0;
    let managersSkippedNoPhone = 0;

    for (const manager of managers) {
        const phone = manager.number?.trim() ?? "";
        if (!phone) {
            managersSkippedNoPhone += 1;
            logger.info(`end-of-day summary skip managerId=${manager.id}: no phone`);
            continue;
        }

        try {
            const [userCards, taskCards] = await Promise.all([
                userCardDetails("today", manager.id),
                taskCardDetails("today", manager.id),
            ]);

            const message = formatEndOfDayManagerSummaryMessage(
                manager.name,
                dateLabel,
                userCards.data,
                taskCards.data,
            );

            const result = await sendMessageOnWhatsapp({ number: phone, message });
            if (result.success) {
                managersSent += 1;
                logger.info(`end-of-day summary sent manager=${phone}`);
            } else {
                managersFailed += 1;
                logger.warn(`end-of-day summary failed manager=${phone} detail=${result.message}`);
            }
        } catch (error) {
            managersFailed += 1;
            logger.error(`end-of-day summary error managerId=${manager.id}`, error);
        }
    }

    let adminSent = false;
    try {
        const adminMessage = formatEndOfDayAdminSummaryMessage(
            dateLabel,
            allUserCards.data,
            allTaskCards.data,
        );
        await notifyAdminMessage(adminMessage);
        adminSent = true;
        logger.info("end-of-day summary sent to admin");
    } catch (error) {
        logger.error("end-of-day summary admin message failed", error);
        await notifyAdminError("end-of-day summary to admin");
    }

    return {
        success: managersFailed === 0 && adminSent,
        message: `End-of-day summary (${dateLabel}): managers sent=${managersSent}, failed=${managersFailed}, skipped=${managersSkippedNoPhone}, admin=${adminSent ? "sent" : "not sent"}.`,
        managersSent,
        managersFailed,
        managersSkippedNoPhone,
        adminSent,
    };
}
