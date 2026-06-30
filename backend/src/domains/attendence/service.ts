import logger from "../../libraries/log/logger";
import { prisma } from "../../libraries/db";
import { AppError } from "../../libraries/error-handling/AppError";
import { AcceptStatus } from "@prisma/client";
import { sendMessageOnWhatsapp, sendWhatsAppButtons } from "../whtsapp/sendWhatsApp";
import { calculateDistance } from "../../libraries/util/Attendence/distance";
import { numberLookupVariants } from "../../libraries/util/Task/number";

const WORK_AREA_LAT = Number(process.env.WORK_AREA_LAT ?? "0");
const WORK_AREA_LONG = Number(process.env.WORK_AREA_LONG ?? "0");
const MAX_PUNCH_IN_DISTANCE_M = Number(process.env.MAX_PUNCH_IN_DISTANCE_M ?? "200");

export const sendPunchInButton = async () => {
    try {
        const users = await prisma.user.findMany({
            where: {
                Dailytask: {
                    some: {
                        status: AcceptStatus.accept,
                        date: new Date(),
                    },
                },
            },
        });

        if (users.length === 0) {
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
        const managerSummarySent = false;

        for (const user of users) {
            const number = user.number;

            if (!number) {
                skippedNoPhone++;
                continue;
            }

            const result = await sendWhatsAppButtons({
                number,
                message: "Please punch in before starting task ",
                buttons: [{ title: "Punch in", id: `punchin_${user.id}` }],
            });

            if (result.success) {
                sent++;
            } else {
                failedSends++;
            }
        }

        return {
            success: true,
            status: 200,
            message: "Punch-in buttons sent",
            sent,
            skippedNoPhone,
            skippedNoTasks: 0,
            failedSends,
            managerSummarySent,
        };
    } catch (error: any) {
        logger.error(`Error in send punch in button to user`, error);
        throw new AppError(`Error in send punch in button to user`, error.message);
    }
};

export const attendence = async (from: string, lat: number, long: number) => {
    try {
        const numberVariants = numberLookupVariants(from);
        const user = await prisma.user.findFirst({
            where: {
                deletedAt: null,
                number: { in: numberVariants.length > 0 ? numberVariants : [from] },
            },
        });

        if (!user) {
            await sendMessageOnWhatsapp({
                number: from,
                message: "User not found. Please contact your manager.",
            });
            return;
        }

        const distance = calculateDistance(WORK_AREA_LAT, WORK_AREA_LONG, lat, long);

        const currentTime = new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
            timeZone: "Asia/Kolkata",
        });

        if (distance <= MAX_PUNCH_IN_DISTANCE_M) {
            await prisma.attendence.create({
                data: {
                    type: "morning",
                    time: currentTime,
                    userId: user.id,
                },
            });

            await sendMessageOnWhatsapp({
                number: from,
                message: "Thank you for checking in with us.",
            });
            return;
        }

        await sendMessageOnWhatsapp({
            number: from,
            message: "You are not in your work area. Please go there and try again.",
        });
    } catch (error: any) {
        logger.error("Error in handle attendence ", error);
        throw new AppError("Internal server while handle Attendence ", error.message);
    }
};
