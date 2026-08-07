import { AcceptStatus, Role, TaskFinalStatus, TaskStaus } from "@prisma/client";
import { prisma } from "../../../libraries/db";
import logger from "../../../libraries/log/logger";
import { AppError } from "../../../libraries/error-handling/AppError";
import { sendMessageOnWhatsapp, sendWhatsAppButtons } from "../../whtsapp/sendWhatsApp";
import { previousTaskmsg } from "../../../domains/messages/previousTask";
import { getISTTodayCalendarDate } from "../../../libraries/util/Task/istDate";
import { notifyAdminError } from "../../../libraries/util/notifyAdminError";
import { findActiveTaskUserByWhatsAppNumber } from "../shared";
import type { TaskResult } from "../types";

type finalchoice = "blocked" | "completed" | "hold"
const PREVIOUS_TASK_HOLD_REMINDER_MS = 2 * 60 * 60 * 1000

type PreviousTaskFollowupData = {
    id: string;
    position: number;
    name: string;
    rawStartTime: string;
    rawEndTime: string;
    status: string
};

export async function sendPreviousTaskFollowupButtons(
    number: string,
    task: PreviousTaskFollowupData,
): Promise<boolean> {
    const msg = previousTaskmsg(task.name, task.rawStartTime, task.rawEndTime)
    const result = await sendWhatsAppButtons({
        number,
        message: msg,
        buttons: [
            { id: `hold_${task.id}`, title: "Hold" },
            { id: `blocked_${task.id}`, title: "Blocked" },
            { id: `completed_${task.id}`, title: "Completed" },
        ],
    })

    if (result.success) {
        if (task.status === TaskStaus.notSend) {
            await prisma.task.update(
                {
                    where: { id: task.id },
                    data: {
                        sent: true,
                        status: TaskStaus.pending
                    }
                }
            )
        }
        logger.info(`send previousTask follow-up to ${number} task position ${task.position}`)
    } else {
        logger.info(`Error in send previousTask follow-up to ${number} task position ${task.position}`)
    }

    return result.success
}

export const handlePendigTaskUpdateText = async (from: string) => {
    try {
        const user = await findActiveTaskUserByWhatsAppNumber(from);

        if (!user) {
            await sendMessageOnWhatsapp({
                number: from,
                message: "User not Found Please contact your Manager",
            });
            return false;
        }

        const currentTime = new Date();
        const todayDate = getISTTodayCalendarDate();

        const tasks = await prisma.task.findMany({
            where: {
                userId: user.id,
                dailyTask: {
                    date: todayDate,
                    deletedAt: null,
                },
                endAt: { lt: currentTime },
                status: { in: ["inProgress", "pending", "remark", "delayed"] },
                finaldecision: null,
                deletedAt: null,
            },
            select: {
                id: true,
                position: true,
                name: true,
                rawStartTime: true,
                rawEndTime: true,
                status: true
            },
            orderBy: { position: "asc" },
        });

        if (tasks.length === 0) {
            logger.info(`No remaining previous task for user=${from}`);
            await sendMessageOnWhatsapp({
                number: from,
                message: "✔️ No pending previous tasks to update.",
            });
            return true;
        }

        for (const t of tasks) {
            await sendPreviousTaskFollowupButtons(from, t);
        }

        return true;
    } catch (error) {
        logger.error("Error while user text UPDATE ", error);
        await notifyAdminError("while user text UPDATE");
        return false;
    }
};

export const handlePreviousPendingTask = async (from: string, dailyTaskId: string, taskPosition: number): Promise<boolean> => {
    try {
        const currentTime = new Date()

        const tasks = await prisma.task.findMany({
            where: {
                dailyTaskId: dailyTaskId,
                endAt: { lt: currentTime },
                position: { lt: taskPosition },
                status: { in: ["inProgress", "pending", "remark", "delayed"] },
                finaldecision: null,
                deletedAt: null
            },
            select: {
                id: true,
                position: true,
                name: true,
                status: true,
                rawStartTime: true,
                rawEndTime: true
            },
            orderBy: { position: "asc" },
        })

        if (tasks.length === 0) {
            logger.info("No remaining previous task.")
            return true
        }

        for (const t of tasks) {
            await sendPreviousTaskFollowupButtons(from, t)
        }

        return true
    } catch (error) {
        logger.error("Error in find Previous-Task", error)
        await notifyAdminError("function Previous pending Task")
        return false
    }
}

export const sendPreviousTaskHoldReminders = async (): Promise<TaskResult> => {
    try {
        const now = new Date()
        const holdDueBefore = new Date(now.getTime() - PREVIOUS_TASK_HOLD_REMINDER_MS)

        const tasks = await prisma.task.findMany({
            where: {
                deletedAt: null,
                status: TaskStaus.hold,
                finaldecision: null,
                lasthold: { lte: holdDueBefore },
                endAt: { lt: now },
                dailyTask: {
                    deletedAt: null,
                    sent: true,
                    status: AcceptStatus.accept,
                    finaldecision: { in: ["onTrack", "remark"] },
                },
                user: { deletedAt: null, role: Role.user },
            },
            select: {
                id: true,
                position: true,
                name: true,
                rawStartTime: true,
                rawEndTime: true,
                status: true,
                user: { select: { number: true } },
            },
        })

        if (tasks.length === 0) {
            return {
                success: true,
                status: 200,
                message: "previous-task hold reminders: no tasks due.",
                sent: 0,
                skippedNoPhone: 0,
                skippedNoTasks: 0,
                failedSends: 0,
                managerSummarySent: false,
            }
        }

        let sent = 0
        let skippedNoPhone = 0
        let failedSends = 0

        for (const task of tasks) {
            const phone = task.user.number?.trim() ?? ""
            if (!phone) {
                skippedNoPhone += 1
                continue
            }

            const success = await sendPreviousTaskFollowupButtons(phone, task)
            if (success) {
                sent += 1
                await prisma.task.update({
                    where: { id: task.id },
                    data: { lasthold: now },
                })
            } else {
                failedSends += 1
            }
        }

        return {
            success: failedSends === 0 || sent > 0,
            status: sent === 0 && tasks.length > 0 ? 502 : 200,
            message: `previous-task hold reminders: ${sent} sent, ${skippedNoPhone} without phone, ${failedSends} failed (${tasks.length} due task(s)).`,
            sent,
            skippedNoPhone,
            skippedNoTasks: 0,
            failedSends,
            managerSummarySent: false,
        }
    } catch (error) {
        logger.error("Error in send Previous Task hold reminders", error)
        await notifyAdminError("send Previous Task hold reminders");
        throw new AppError("Error in send Previous Task hold reminders", (error as Error).message)
    }
}

export const handlePreviousTaskFollowupStatus = async (taskId: string, from: string, choice: finalchoice): Promise<boolean> => {
    try {

        const currentTime = new Date()
        const user = await findActiveTaskUserByWhatsAppNumber(from)

        if (!user) {
            await sendMessageOnWhatsapp({ number: from, message: "user not Found , please contact Admin/Manager" })
            return false
        }

        const task = await prisma.task.findFirst({ where: { id: taskId, status: { not: "deleted" } } })

        if (!task) {
            await sendMessageOnWhatsapp({ number: from, message: "Task Not Found !" })
            return false
        }

        switch (choice) {
            case "blocked":
                await prisma.task.update({ where: { id: taskId }, data: { finaldecision: TaskFinalStatus.blocked } })
                await sendMessageOnWhatsapp({ number: from, message: "Thanks for updating the status on your previous task." })
                break

            case "completed":
                await prisma.task.update({
                    where: { id: taskId },
                    data: { finaldecision: TaskFinalStatus.completed, completedAt: new Date() },
                })
                await sendMessageOnWhatsapp({ number: from, message: "Thanks for updating the status on your previous task." })
                break

            case "hold":
                await prisma.task.update({ where: { id: taskId }, data: { status: TaskStaus.hold, lasthold: currentTime } })
                await sendMessageOnWhatsapp({
                    number: from,
                    message: "Got it. We will ask you again in 2 hours.",
                })
                break
        }

        return true
    } catch (error) {
        logger.error("Error in Handle Previous task status", error)
        await notifyAdminError("Handle Previous-Task status")
        return false
    }
}
