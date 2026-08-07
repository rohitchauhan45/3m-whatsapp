import { DelayType, Role, TaskFinalStatus, TaskStaus } from "@prisma/client";
import { prisma } from "../../../libraries/db";
import logger from "../../../libraries/log/logger";
import { AppError } from "../../../libraries/error-handling/AppError";
import { convertUserTimeToMinutes, shiftRawTimeByMinutes } from "../../../libraries/util/Task/timing";
import { sendMessageOnWhatsapp, sendWhatsAppButtons } from "../../whtsapp/sendWhatsApp";
import {
    managerFollowUpFailureMessage,
    managerFollowUpSummaryMessage,
    taskremarkresontoManager,
    userFollowUpTaskMessage,
} from "../../messages/followupMessage";
import { startTaskEarlyMessage } from "../../messages/startTaskMessage";
import { reasonMessage } from "../../messages/reason";
import { normalizeChoiceforTaskfollowUp, normlizeChiocestartChoice } from "../../../libraries/util/Task/status";
import { delayinprogressTaskMessagetoManager, delaystartTaskMessagetoManager } from "../../messages/delayedTask";
import { notifyAdminError } from "../../../libraries/util/notifyAdminError";
import { findActiveTaskUserByWhatsAppNumber } from "../shared";
import { handlePreviousPendingTask } from "../Previous/service";
import type { TaskResult } from "../types";

type choices = "inphourly" | "inpendtime" | "remark" | "done"
type startChoice = "start" | "taskquery" | "delay"
type FollowUpPendingStep = "howMuchComplete" | "extraTime" | "remarkReason";
const FOLLOW_UP_PENDING_TTL_MS = 30 * 60 * 1000;

const pendingFollowUpByUserId = new Map<
    string,
    { taskId: string; step: FollowUpPendingStep; expiresAt: number, mode: "hourly" | "endtime" }
>();

const pruneExpiredFollowUpPending = (now = Date.now()): void => {
    for (const [userId, entry] of pendingFollowUpByUserId.entries()) {
        if (entry.expiresAt <= now) pendingFollowUpByUserId.delete(userId);
    }
}

const setPendingFollowUp = (userId: string, taskId: string, step: FollowUpPendingStep, mode: "hourly" | "endtime"): void => {
    pruneExpiredFollowUpPending();
    pendingFollowUpByUserId.set(userId, {
        taskId,
        step,
        expiresAt: Date.now() + FOLLOW_UP_PENDING_TTL_MS,
        mode
    });
}

const getPendingFollowUp = (userId: string) => {
    pruneExpiredFollowUpPending();
    const entry = pendingFollowUpByUserId.get(userId);
    if (!entry || entry.expiresAt <= Date.now()) {
        pendingFollowUpByUserId.delete(userId);
        return null;
    }
    return entry;
}

const clearPendingFollowUp = (userId: string): void => {
    pendingFollowUpByUserId.delete(userId);
}
const pendingStartTaskDelayTimeByUserId = new Map<string, string>();

export const sendStartTask = async (
    taskIds: string[],
    mode: "early" | "onTime",
): Promise<TaskResult> => {
    try {
        if (taskIds.length === 0) {
            return {
                success: true,
                status: 200,
                message: `start task (${mode}): no tasks due this minute.`,
                sent: 0,
                skippedNoPhone: 0,
                skippedNoTasks: 0,
                failedSends: 0,
                managerSummarySent: false,
            };
        }

        const tasks = await prisma.task.findMany({
            where: {
                id: { in: taskIds },
                deletedAt: null,
                user: { deletedAt: null, role: Role.user },
            },
            select: {
                id: true,
                name: true,
                description: true,
                rawStartTime: true,
                rawEndTime: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        number: true,
                        parent: { select: { id: true, name: true, number: true } },
                    },
                },
            },
        });

        let sent = 0;
        let skippedNoPhone = 0;
        let failedSends = 0;
        const sendAt = new Date();

        const managerStats = new Map<
            string,
            { manager: { id: string; name: string; number: string }; sent: number; userIds: Set<string> }
        >();

        for (const task of tasks) {
            const phone = task.user.number?.trim() ?? "";
            if (!phone) {
                skippedNoPhone += 1;
                continue;
            }

            let result

            switch (mode) {
                case "early":
                    result = await sendWhatsAppButtons({
                        number: phone,
                        message: startTaskEarlyMessage({
                            name: task.name,
                            description: task.description,
                            rawStartTime: task.rawStartTime,
                            rawEndTime: task.rawEndTime,
                        }),
                        buttons: [
                            { title: "On Track", id: `start_${task.id}` },
                            { title: "Remark", id: `taskquery_${task.id}` },
                        ],
                    })
                    break
                case "onTime":
                    result = await sendWhatsAppButtons({
                        number: phone,
                        message: startTaskEarlyMessage({
                            name: task.name,
                            description: task.description,
                            rawStartTime: task.rawStartTime,
                            rawEndTime: task.rawEndTime,
                        }),
                        buttons: [
                            { title: "in Progress", id: `start_${task.id}` },
                            { title: "Delay", id: `delay_${task.id}` },
                            { title: "Block", id: `taskquery_${task.id}` }
                        ],
                    })
                    break

            }

            if (result.success) {
                sent += 1;

                if (mode === "onTime") {
                    await prisma.task.update({
                        where: { id: task.id },
                        data: { sent: true, sendAt, status: TaskStaus.pending },
                    });
                }

                logger.info(`start-task (${mode}) sent user =${task.user.number}`);

                if (mode === "early") {
                    const mgr = task.user.parent;
                    if (mgr) {
                        const stat = managerStats.get(mgr.id) ?? {
                            manager: mgr,
                            sent: 0,
                            userIds: new Set<string>(),
                        };
                        stat.sent += 1;
                        stat.userIds.add(task.user.id);
                        managerStats.set(mgr.id, stat);
                    }
                }
            } else {
                failedSends += 1;
                logger.warn(
                    `start-task (${mode}) failed to user number=${task.user.number} detail=${result.message}`,
                );
            }
        }

        let managerSummarySent = false;
        if (mode === "early") {
            for (const { manager, sent: mgrSent, userIds } of managerStats.values()) {
                if (mgrSent === 0) continue;

                const managerPhone = manager.number?.trim() ?? "";
                if (!managerPhone) continue;

                const summaryBody = managerFollowUpSummaryMessage(
                    manager.name,
                    mgrSent,
                    mgrSent,
                    userIds.size,
                    0,
                    0,
                    failedSends,
                );
                const mgrResult = await sendMessageOnWhatsapp({
                    number: managerPhone,
                    message: summaryBody,
                });
                if (mgrResult.success) {
                    managerSummarySent = true;
                    logger.info(`start-task early manager summary sent managerId=${manager.number}`);
                } else {
                    logger.warn(
                        `start-task early manager summary failed manager number=${manager.number} detail=${mgrResult.message}`,
                    );
                }
            }
        }

        return {
            success: failedSends === 0 || sent > 0,
            status: sent === 0 && taskIds.length > 0 ? 502 : 200,
            message: `start-task (${mode}): ${sent} sent, ${skippedNoPhone} without phone, ${failedSends} failed (${taskIds.length} due task(s)). Manager summary: ${managerSummarySent ? "sent" : "not sent"}.`,
            sent,
            skippedNoPhone,
            skippedNoTasks: 0,
            failedSends,
            managerSummarySent,
        };
    } catch (error) {
        logger.error("error in send start task ", error)
        await notifyAdminError("send start task");
        throw new AppError("internal server Error while send start task", error.message)
    }
}

export const handleStarttaskStatus = async (taskId: string, whatsappFrom: string, ch: startChoice) => {
    try {
        const user = await findActiveTaskUserByWhatsAppNumber(whatsappFrom);

        if (!user) {
            await sendMessageOnWhatsapp({
                number: whatsappFrom,
                message: "No user found. Please contact your manager.",
            });
            return;
        }

        const task = await prisma.task.findFirst({
            where: { id: taskId, userId: user.id, deletedAt: null },
        });

        if (!task) {
            await sendMessageOnWhatsapp({ number: user.number, message: "Task not found." });
            return;
        }

        const choice = normlizeChiocestartChoice(ch)

        if (choice === TaskStaus.inProgress) {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: TaskStaus.inProgress },
            });
            await sendMessageOnWhatsapp({
                number: user.number,
                message:
                    "Thanks for update !",
            });

            if (task.position > 1) {
                await handlePreviousPendingTask(whatsappFrom, task.dailyTaskId, task.position)
            }

            return;
        }

        if (choice === TaskStaus.remark) {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: TaskStaus.remark },
            });
            setPendingFollowUp(user.id, taskId, "remarkReason", "endtime");
            await sendMessageOnWhatsapp({
                number: user.number,
                message: reasonMessage("remark", user.name),
            });
            return;
        }

        if (choice === TaskStaus.delayed) {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: TaskStaus.delayed },
            });

            pendingStartTaskDelayTimeByUserId.set(user.id, taskId)
            if (pendingStartTaskDelayTimeByUserId.size > 1000) {
                const first = pendingStartTaskDelayTimeByUserId.keys().next().value
                if (first) pendingStartTaskDelayTimeByUserId.delete(first)
            }

            await sendMessageOnWhatsapp({ number: user.number, message: "⏱️ How long will it take you to start the task? (ex. 10min ,1hour ,24m)" })
        }

    } catch (error) {
        logger.error("Error in handle start task status", error)
        await notifyAdminError("handle start task status");
        throw new AppError("Internal server Error while handle the start task Status", error.message)
    }
}

export const handleStartTaskDelayTime = async (from: string, time: string) => {
    try {
        const user = await findActiveTaskUserByWhatsAppNumber(from)

        if (!user) return false

        const taskId = pendingStartTaskDelayTimeByUserId.get(user.id)
        if (!taskId) return false

        const resultTime = convertUserTimeToMinutes(time);
        if (!resultTime || resultTime <= 0) {
            await sendMessageOnWhatsapp({
                number: from,
                message: "Invalid time. Please send again (e.g. 1hour, 30min, 1kalak).",
            });
            return true;
        }

        const extraTimeMs = resultTime * 60_000;

        const currentTask = await prisma.task.findFirst({
            where: { id: taskId, deletedAt: null },
            select: {
                name: true,
                rawStartTime: true,
                startAt: true,
                endAt: true,
                position: true,
                rawEndTime: true,
                dailyTaskId: true,
                dailyTask: { select: { date: true } },
                user: {
                    select: {
                        name: true,
                        parent: { select: { id: true, name: true, number: true } },
                    },
                },
            },
        });

        if (!currentTask) {
            await sendMessageOnWhatsapp({ number: from, message: "Task not found." });
            pendingStartTaskDelayTimeByUserId.delete(user.id);
            return true;
        }

        const oldRawStarttime = currentTask.rawStartTime
        const oldRawEndTime = currentTask.rawEndTime;

        const taskDate = currentTask.dailyTask.date;
        const newRawEndTime = shiftRawTimeByMinutes(taskDate, currentTask.rawEndTime, resultTime);
        const newRawStartTime = shiftRawTimeByMinutes(taskDate, currentTask.rawStartTime, resultTime)

        if (!newRawEndTime) {
            await sendMessageOnWhatsapp({ number: from, message: "Could not update task time. Please try again." });
            return true;
        }

        const nextTasks = await prisma.task.findMany({
            where: {
                dailyTaskId: currentTask.dailyTaskId,
                deletedAt: null,
                startAt: { gt: currentTask.startAt },
            },
            orderBy: { startAt: "asc" },
            select: {
                id: true,
                startAt: true,
                endAt: true,
                rawStartTime: true,
                rawEndTime: true,
            },
        });

        const newEnd = new Date(currentTask.endAt.getTime() + extraTimeMs);
        const newStart = new Date(currentTask.startAt.getTime() + extraTimeMs)

        await prisma.$transaction(async (tx) => {
            await tx.task.update({
                where: { id: taskId },
                data: {
                    startAt: newStart,
                    extratTme: resultTime,
                    rawStartTime: newRawStartTime,
                    endAt: newEnd,
                    rawEndTime: newRawEndTime,
                    delayType: DelayType.notStartedOnTime
                },
            });

            for (const task of nextTasks) {
                const shiftedRawStart = shiftRawTimeByMinutes(taskDate, task.rawStartTime, resultTime);
                const shiftedRawEnd = shiftRawTimeByMinutes(taskDate, task.rawEndTime, resultTime);
                if (!shiftedRawStart || !shiftedRawEnd) {
                    throw new Error(`Invalid raw time for task ${task.id}`);
                }

                await tx.task.update({
                    where: { id: task.id },
                    data: {
                        startAt: new Date(task.startAt.getTime() + extraTimeMs),
                        endAt: new Date(task.endAt.getTime() + extraTimeMs),
                        rawStartTime: shiftedRawStart,
                        rawEndTime: shiftedRawEnd,
                    },
                });
            }
        });

        await sendMessageOnWhatsapp({ number: user.number, message: "please start the task ASAP" })
        pendingStartTaskDelayTimeByUserId.delete(user.id);

        if (currentTask.position > 1) {
            await handlePreviousPendingTask(from, currentTask.dailyTaskId, currentTask.position)
        }

        const manager = currentTask.user.parent;
        const managerPhone = manager?.number?.trim() ?? "";
        if (manager && managerPhone) {
            const msg = delaystartTaskMessagetoManager(
                manager.name,
                currentTask.user.name,
                from,
                {
                    name: currentTask.name,
                    oldStartTime: oldRawStarttime,
                    newStartTime: currentTask.rawStartTime,
                    oldEndTime: oldRawEndTime,
                    newEndTime: newRawEndTime,
                    extraMinutes: resultTime,
                },
            );
            const mgrResult = await sendMessageOnWhatsapp({
                number: managerPhone,
                message: msg,
            });
            if (!mgrResult.success) {
                logger.warn(
                    `start task extra time delay to manager failed manager=${manager.number} detail=${mgrResult.message}`,
                );
            }
        }

        return true;
    } catch (error) {
        logger.error("Error in handle start task delay time", error)
        await notifyAdminError("handle start task delay time");
        throw new AppError("Internal server Error while handle the start task delay time", error.message)
    }
}

/** Manager sends follow-up for the given task ids (due now — ids resolved in scheduler / API). */
export const sendTaskFollowUp = async (taskIds: string[], mode: "hourly" | "endtime",): Promise<TaskResult> => {
    try {
        if (taskIds.length === 0) {
            return {
                success: true,
                status: 200,
                message: "Follow-up: no tasks due this minute.",
                sent: 0,
                skippedNoPhone: 0,
                skippedNoTasks: 0,
                failedSends: 0,
                managerSummarySent: false,
            };
        }

        const tasks = await prisma.task.findMany({
            where: {
                id: { in: taskIds },
                deletedAt: null,
                user: { deletedAt: null, role: Role.user },
            },
            select: {
                id: true,
                name: true,
                description: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        number: true,
                        parent: { select: { id: true, name: true, number: true } },
                    },
                },
            },
        });

        let sent = 0;
        let skippedNoPhone = 0;
        let failedSends = 0;
        const sendAt = new Date();

        const managerFailures = new Map<
            string,
            {
                manager: { id: string; name: string; number: string };
                failed: number;
                users: Map<string, { name: string; number: string }>;
            }
        >();

        for (const task of tasks) {
            const phone = task.user.number?.trim() ?? "";
            if (!phone) {
                skippedNoPhone += 1;
                continue;
            }

            const result = await sendWhatsAppButtons({
                number: phone,
                message: userFollowUpTaskMessage(task),
                buttons: [
                    { title: "in Progress", id: `${mode === "hourly" ? "inphourly" : "inpendtime"}_${task.id}` },
                    { title: "Remark", id: `remark_${task.id}` },
                    { title: "Done", id: `done_${task.id}` },
                ],
            });

            if (result.success) {
                sent += 1;
                await prisma.task.update({
                    where: { id: task.id },
                    data: { sent: true, sendAt },
                });
                logger.info(`task-follow-up sent user =${task.user.number}`);
            } else {
                failedSends += 1;
                logger.warn(
                    `task-follow-up failed to user number=${task.user.number} detail=${result.message}`,
                );

                const mgr = task.user.parent;
                if (mgr) {
                    const stat = managerFailures.get(mgr.id) ?? {
                        manager: mgr,
                        failed: 0,
                        users: new Map<string, { name: string; number: string }>(),
                    };
                    stat.failed += 1;
                    stat.users.set(task.user.id, {
                        name: task.user.name || "Unknown",
                        number: task.user.number || "—",
                    });
                    managerFailures.set(mgr.id, stat);
                }
            }
        }

        let managerSummarySent = false;
        for (const { manager, failed, users } of managerFailures.values()) {
            if (failed === 0) continue;

            const managerPhone = manager.number?.trim() ?? "";
            if (!managerPhone) continue;

            const failBody = managerFollowUpFailureMessage(
                manager.name,
                failed,
                [...users.values()],
            );

            const mgrResult = await sendMessageOnWhatsapp({
                number: managerPhone,
                message: failBody,
            });

            if (mgrResult.success) {
                managerSummarySent = true;
                logger.info(`task follow-up failure alert sent manager=${manager.number}`);
            } else {
                logger.warn(
                    `task follow-up failure alert failed manager number=${manager.number} detail=${mgrResult.message}`,
                );
            }
        }

        return {
            success: failedSends === 0 || sent > 0,
            status: sent === 0 && taskIds.length > 0 ? 502 : 200,
            message: `Follow-up: ${sent} sent, ${skippedNoPhone} without phone, ${failedSends} failed (${taskIds.length} due task(s)). Manager alert: ${managerSummarySent ? "sent" : "not sent"}.`,
            sent,
            skippedNoPhone,
            skippedNoTasks: 0,
            failedSends,
            managerSummarySent,
        };
    } catch (error) {
        logger.error("Error in Give follow-up : ", error);
        await notifyAdminError("send follow-up task");
        throw new AppError(`Error in get Follow-up task : `, error.message);
    }
};

export const handleFollowUp = async (taskId: string, whatsappFrom: string, ch: choices) => {
    try {
        const user = await findActiveTaskUserByWhatsAppNumber(whatsappFrom);

        if (!user) {
            await sendMessageOnWhatsapp({
                number: whatsappFrom,
                message: "No user found. Please contact your manager.",
            });
            return;
        }

        const task = await prisma.task.findFirst({
            where: { id: taskId, userId: user.id, deletedAt: null },
        });

        if (!task) {
            await sendMessageOnWhatsapp({ number: user.number, message: "Task not found." });
            return;
        }

        const choice = normalizeChoiceforTaskfollowUp(ch);

        if (!choice) {
            await sendMessageOnWhatsapp({ number: user.number, message: "Invalid choice for the task." });
            return;
        }

        if (choice === TaskStaus.inProgress) {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: TaskStaus.inProgress },
            });
            if (ch === "inphourly") {
                setPendingFollowUp(user.id, taskId, "howMuchComplete", "hourly");
            } else if (ch === "inpendtime") {
                setPendingFollowUp(user.id, taskId, "howMuchComplete", "endtime");
            }
            await sendMessageOnWhatsapp({
                number: user.number,
                message:
                    "Please tell how much of the task is complete (e.g. 50%, 85%, 10 feet, 5 meter, etc.)",
            });
            return;
        }

        if (choice === TaskStaus.remark) {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: TaskStaus.remark },
            });
            setPendingFollowUp(user.id, taskId, "remarkReason", "endtime");
            await sendMessageOnWhatsapp({
                number: user.number,
                message: reasonMessage("remark", user.name),
            });
            return;
        }

        if (choice === TaskFinalStatus.completed) {

            const currentTime = new Date()
            await prisma.task.update({
                where: { id: taskId },
                data: { finaldecision: TaskFinalStatus.completed, completedAt: currentTime },
            });
            clearPendingFollowUp(user.id);
            await sendMessageOnWhatsapp({
                number: user.number,
                message: "Thank you! Task marked as done.",
            });

            if (task.position > 1) {
                await handlePreviousPendingTask(whatsappFrom, task.dailyTaskId, task.position)
            }
        }
    } catch (error) {
        logger.error(`Error in handle Follow-up Task`, error);
        await notifyAdminError("handle follow-up Task");
        throw new AppError(`Error in handle follow-up Task`, error.message);
    }
};

/** Next text from user after follow-up buttons (in progress / remark). */
export const handleFollowUpReply = async (whatsappFrom: string, text: string): Promise<boolean> => {
    try {
        const clean = text.trim();
        if (!clean) return false;

        const user = await findActiveTaskUserByWhatsAppNumber(whatsappFrom);
        if (!user) return false;

        const pending = getPendingFollowUp(user.id);
        if (!pending) return false;

        const phone = user.number;
        const task = await prisma.task.findFirst({
            where: { id: pending.taskId, userId: user.id, deletedAt: null },
        });
        if (!task) {
            clearPendingFollowUp(user.id);
            return false;
        }

        if (pending.step === "howMuchComplete") {
            await handleInProgressTask(pending.taskId, phone, clean, pending.mode);

            if (pending.mode === "endtime") {
                setPendingFollowUp(user.id, pending.taskId, "extraTime", "endtime");
            } else {
                clearPendingFollowUp(user.id);
            }

            return true;
        }

        if (pending.step === "extraTime") {
            const saved = await handleExtratime(pending.taskId, phone, clean);
            if (saved) clearPendingFollowUp(user.id);

            if (task.position > 1) {
                await handlePreviousPendingTask(whatsappFrom, task.dailyTaskId, task.position)
            }

            return saved;
        }

        if (pending.step === "remarkReason") {
            await prisma.task.update({
                where: { id: pending.taskId },
                data: { remarkReason: clean, status: TaskStaus.remark },
            });

            clearPendingFollowUp(user.id);

            await sendMessageOnWhatsapp({
                number: phone,
                message: "Thank you! Remark reason saved.",
            });

            if (task.position > 1) {
                await handlePreviousPendingTask(whatsappFrom, task.dailyTaskId, task.position)
            }

            if (user.parentId) {
                const manager = await prisma.user.findFirst({
                    where: { id: user.parentId, role: Role.manager, deletedAt: null },
                });
                const managerPhone = manager?.number?.trim() ?? "";
                if (manager && managerPhone) {
                    const msg = taskremarkresontoManager(
                        manager.name,
                        user.name,
                        whatsappFrom,
                        task.name,
                        clean,
                    );
                    const mgrResult = await sendMessageOnWhatsapp({
                        number: managerPhone,
                        message: msg,
                    });
                    if (!mgrResult.success) {
                        logger.warn(
                            `remark reason to manager failed manager=${manager.number} detail=${mgrResult.message}`,
                        );
                    }
                }
            }

            return true;
        }

        return false;
    } catch (error) {
        logger.error("Error in handle follow-up reply", error);
        await notifyAdminError("handle follow-up reply");
        return false;
    }
};

export const handleInProgressTask = async (taskId: string, phone: string, answer: string, mode: "hourly" | "endtime") => {
    await prisma.task.update({
        where: { id: taskId },
        data: { howmuchComplete: answer.trim() },
    });

    await sendMessageOnWhatsapp({
        number: phone,
        message: mode === "endtime"
            ? "How much more time do you need to complete this task? (e.g. 1hour, 1.5hour, 1kalak, 10min, 2kalak)"
            : "Thanks for update !",
    });
};

const handleExtratime = async (id: string, from: string, etime: string): Promise<boolean> => {
    try {
        const resultTime = convertUserTimeToMinutes(etime);
        if (!resultTime || resultTime <= 0) {
            await sendMessageOnWhatsapp({
                number: from,
                message: "Invalid time. Please send again (e.g. 1hour, 30min, 1kalak).",
            });
            return false;
        }

        const extraTimeMs = resultTime * 60_000;

        const currentTask = await prisma.task.findFirst({
            where: { id, deletedAt: null },
            select: {
                name: true,
                rawStartTime: true,
                startAt: true,
                endAt: true,
                rawEndTime: true,
                dailyTaskId: true,
                dailyTask: { select: { date: true } },
                user: {
                    select: {
                        name: true,
                        parent: { select: { id: true, name: true, number: true } },
                    },
                },
            },
        });

        if (!currentTask) {
            await sendMessageOnWhatsapp({ number: from, message: "Task not found." });
            return false;
        }

        const oldRawEndTime = currentTask.rawEndTime;
        const taskDate = currentTask.dailyTask.date;
        const newRawEndTime = shiftRawTimeByMinutes(taskDate, currentTask.rawEndTime, resultTime);
        if (!newRawEndTime) {
            await sendMessageOnWhatsapp({ number: from, message: "Could not update task time. Please try again." });
            return false;
        }

        const nextTasks = await prisma.task.findMany({
            where: {
                dailyTaskId: currentTask.dailyTaskId,
                deletedAt: null,
                startAt: { gt: currentTask.startAt },
            },
            orderBy: { startAt: "asc" },
            select: {
                id: true,
                startAt: true,
                endAt: true,
                rawStartTime: true,
                rawEndTime: true,
            },
        });

        const newEnd = new Date(currentTask.endAt.getTime() + extraTimeMs);

        await prisma.$transaction(async (tx) => {
            await tx.task.update({
                where: { id },
                data: {
                    extratTme: resultTime,
                    endAt: newEnd,
                    rawEndTime: newRawEndTime,
                    delayType: DelayType.exceededExpectedTime
                },
            });

            for (const task of nextTasks) {
                const shiftedRawStart = shiftRawTimeByMinutes(taskDate, task.rawStartTime, resultTime);
                const shiftedRawEnd = shiftRawTimeByMinutes(taskDate, task.rawEndTime, resultTime);
                if (!shiftedRawStart || !shiftedRawEnd) {
                    throw new Error(`Invalid raw time for task ${task.id}`);
                }

                await tx.task.update({
                    where: { id: task.id },
                    data: {
                        startAt: new Date(task.startAt.getTime() + extraTimeMs),
                        endAt: new Date(task.endAt.getTime() + extraTimeMs),
                        rawStartTime: shiftedRawStart,
                        rawEndTime: shiftedRawEnd,
                    },
                });
            }
        });

        await sendMessageOnWhatsapp({
            number: from,
            message: "Thank you! Extra time saved.",
        });

        const manager = currentTask.user.parent;
        const managerPhone = manager?.number?.trim() ?? "";
        if (manager && managerPhone) {
            const msg = delayinprogressTaskMessagetoManager(
                manager.name,
                currentTask.user.name,
                from,
                {
                    name: currentTask.name,
                    startTime: currentTask.rawStartTime,
                    oldEndTime: oldRawEndTime,
                    newEndTime: newRawEndTime,
                    extraMinutes: resultTime,
                },
            );
            const mgrResult = await sendMessageOnWhatsapp({
                number: managerPhone,
                message: msg,
            });
            if (!mgrResult.success) {
                logger.warn(
                    `extra time delay to manager failed manager=${manager.number} detail=${mgrResult.message}`,
                );
            }
        }

        return true;
    } catch (error) {
        logger.error("Error in handle Extra time in task", error);
        await notifyAdminError("handle Extra time in task");
        await sendMessageOnWhatsapp({
            number: from,
            message: "Could not save extra time. Please try again.",
        });
        return false;
    }
};