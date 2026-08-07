import { AcceptStatus, Role, TaskFinalStatus, TaskStaus, onTrackStatus } from "@prisma/client";
import { prisma } from "../../../libraries/db";
import logger from "../../../libraries/log/logger";
import { AppError } from "../../../libraries/error-handling/AppError";
import {
    sendAssignTaskMessage,
    formatAssignTaskListForTemplate,
    sendManagerRemainingStatusMessage,
    sendManagerSummaryofAssisgnMessage,
} from "../../messages/assignTaskMessages";
import { sendMessageOnWhatsapp, sendWhatsAppButtons, sendWhatsappTemplate } from "../../whtsapp/sendWhatsApp";
import { reasonMessage } from "../../messages/reason";
import { normlizeChoiceforDaily } from "../../../libraries/util/Task/status";
import { finalDecisionMessage } from "../../../domains/messages/ontrack";
import { morningAbsentResontoManager, morningRemarkResontoManager } from "../../messages/morningOntrack";
import {
    formatCalendarDateLabel,
    getISTTodayCalendarDate,
    getISTTomorrowCalendarDate,
} from "../../../libraries/util/Task/istDate";
import { notifyAdminError } from "../../../libraries/util/notifyAdminError";
import { findActiveTaskUserByWhatsAppNumber } from "../shared";
import type { FinalDecisionResult, RemainingStatusResult, TaskResult } from "../types";
import { sendStartTask } from "../Follow-up/service";
import { sendPreviousTaskFollowupButtons } from "../Previous/service";

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 10_000;
const delay = (ms: number) => { return new Promise((r) => setTimeout(r, ms)); }
const pendingDeclineReasonByUserId = new Map<string, string>();
const pendingFinalDecisionRemarkByUserId = new Map<string, string>();
const pendingFinalDecisionAbsentByUserId = new Map<string, string>();

export const assignTask = async (managerId?: string): Promise<TaskResult> => {
    try {
        const assignDate = getISTTomorrowCalendarDate();
        const assignDateLabel = formatCalendarDateLabel(assignDate);

        const managers = await prisma.user.findMany({
            where: {
                ...(managerId ? { id: managerId } : {}),
                role: Role.manager,
                deletedAt: null,
            },
            include: {
                children: {
                    where: { deletedAt: null, role: Role.user },
                    include: {
                        Dailytask: {
                            where:
                            {
                                deletedAt: null,
                                date: assignDate,
                                sent: false,
                                sendAt: null,
                            },
                            orderBy: { date: "asc" },
                            include: {
                                tasks: {
                                    where: { deletedAt: null },
                                },
                            }
                        }
                    },
                },
            },
        });

        if (managers.length === 0) {
            return {
                success: false,
                status: 404,
                message: "Manager not found or is not an active manager role",
                sent: 0,
                skippedNoPhone: 0,
                skippedNoTasks: 0,
                failedSends: 0,
                managerSummarySent: false,
            };
        }

        let sent = 0;
        let skippedNoPhone = 0;
        let skippedNoTasks = 0;
        let failedSends = 0;
        let managerSummarySent = false;

        for (const manager of managers) {
            for (const child of manager.children) {
                const dailyTask = child.Dailytask?.[0];
                if (!dailyTask || dailyTask.tasks.length === 0) {
                    skippedNoTasks += 1;
                    logger.info(
                        `assign-task skip userId=${child.id} name=${child.name}: no unsent tasks for ${assignDateLabel}`,
                    );
                    continue;
                }

                const phone = child.number?.trim() ?? "";
                if (!phone) {
                    skippedNoPhone += 1;
                    logger.info(`assign-task skip userId=${child.id} name=${child.name}: no phone number`);
                    continue;
                }

                // Batch throttling
                if (sent > 0 && sent % BATCH_SIZE === 0) {
                    logger.info(`assign-task batch limit ${BATCH_SIZE} reached, pausing ${BATCH_DELAY_MS}ms...`);
                    await delay(BATCH_DELAY_MS);
                }

                const existingConversation = await prisma.whatsAppConversation.findFirst({
                    where: { userId: child.id },
                });

                let result;
                let sendAt: Date | undefined;

                if (!existingConversation) {
                    const taskList = formatAssignTaskListForTemplate(
                        dailyTask.tasks.map((t) => ({
                            name: t.name,
                            rawStartTime: t.rawStartTime,
                            rawEndTime: t.rawEndTime,
                        })),
                    );
                    // Case 1: user never touched us before → send welcome template
                    sendAt = new Date();
                    result = await sendWhatsappTemplate({
                        number: child.number,
                        tname: "daily_task_assignment",
                        parameters: [
                            { parameter_name: "user_name", text: child.name },
                            { parameter_name: "task_list", text: taskList },
                        ],
                        buttons: [
                            { title: "Accept", id: `accept_${dailyTask.id}` },
                            { title: "Decline", id: `decline_${dailyTask.id}` },
                        ],
                    });
                } else {
                    const windowExpireTime = existingConversation.windowExpiresAt;
                    const currentTime = new Date();
                    const hasOpenWindow =
                        windowExpireTime !== null && windowExpireTime.getTime() > currentTime.getTime();

                    if (hasOpenWindow) {
                        // Case 2: user has active 24h window → send simple interactive message (accept / decline)
                        const body = sendAssignTaskMessage(
                            child.name,
                            dailyTask.tasks.map((t) => ({
                                name: t.name,
                                rawStartTime: t.rawStartTime,
                                rawEndTime: t.rawEndTime,
                            })),
                        );
                        sendAt = new Date();

                        result = await sendWhatsAppButtons({
                            number: phone,
                            message: body,
                            buttons: [
                                {
                                    title: "Accept",
                                    id: `accept_${dailyTask.id}`,
                                },
                                {
                                    title: "Decline",
                                    id: `decline_${dailyTask.id}`,
                                },
                            ],
                        });
                    } else {
                        // Case 3: user has conversation but window expired → send template with parameters & buttons
                        const taskList = formatAssignTaskListForTemplate(
                            dailyTask.tasks.map((t) => ({
                                name: t.name,
                                rawStartTime: t.rawStartTime,
                                rawEndTime: t.rawEndTime,
                            })),
                        );
                        sendAt = new Date();
                        result = await sendWhatsappTemplate({
                            number: child.number,
                            tname: "daily_task_assignment",
                            parameters: [
                                { parameter_name: "user_name", text: child.name },
                                { parameter_name: "task_list", text: taskList },
                            ],
                            buttons: [
                                { title: "Accept", id: `accept_${dailyTask.id}` },
                                { title: "Decline", id: `decline_${dailyTask.id}` },
                            ],
                        });
                    }
                }

                if (result && result.success) {
                    sent += 1;
                    await prisma.dailyTask.update({
                        where: { id: dailyTask.id },
                        data: { sent: true, sendAt, status: AcceptStatus.remaining },
                    })
                    logger.info(
                        `assign-task sent success user number =${child.number}`
                    );
                } else {
                    failedSends += 1;
                    logger.warn(
                        `assign task failed to user number=${child.number} detail=${result.message}`
                    );
                }
            }

            // Send summary to this manager
            const totalUsers = manager.children.length;
            const managerPhone = manager.number?.trim() ?? "";
            if (managerPhone) {
                const summaryBody = sendManagerSummaryofAssisgnMessage(
                    manager.name,
                    sent,
                    totalUsers,
                    skippedNoTasks,
                    skippedNoPhone,
                    failedSends
                );
                const mgrResult = await sendMessageOnWhatsapp({
                    number: managerPhone,
                    message: summaryBody,
                });
                if (mgrResult.success) {
                    managerSummarySent = true;
                    logger.info(`manager summary sent of assign task managernum =${manager.number}`);
                } else {
                    logger.warn(
                        `manager assign task summary WhatsApp failed manager number =${manager.number} detail=${mgrResult.message}`
                    );
                }
            } else {
                logger.info(`assign-task manager has no phone — summary WhatsApp skipped managerId=${manager.id}`);
            }
        }

        const totalUsers = managers.reduce((n, m) => n + m.children.length, 0);

        return {
            success: true,
            status: 200,
            message: `Assign (${assignDateLabel}): processed ${totalUsers} team member(s): ${sent} message thread(s) sent, ${skippedNoTasks} without tasks for that date, ${skippedNoPhone} without phone, ${failedSends} send error(s). Manager summary: ${managerSummarySent ? "sent" : "not sent"}.`,
            sent,
            skippedNoPhone,
            skippedNoTasks,
            failedSends,
            managerSummarySent,
        };
    } catch (error) {
        logger.error("Error in Assign task : ", error)
        await notifyAdminError("Assign task to user")
        throw new AppError(`Error in Assign task to user`, error.message)
    }

};

export const updateTaskAcceptFromWhatsApp = async (
    id: string,
    whatsappFrom: string,
    choice: "accept" | "decline",
): Promise<void> => {
    if (!id.trim()) {
        logger.warn(`accept/decline: missing dailyTask id from=${whatsappFrom}`);
        return;
    }

    const user = await findActiveTaskUserByWhatsAppNumber(whatsappFrom);
    if (!user) {
        logger.info(`Daily Task no user for from=${whatsappFrom}`);
        return;
    }

    const dailyTask = await prisma.dailyTask.findFirst({
        where: { id, userId: user.id, deletedAt: null },
    });
    if (!dailyTask) {
        logger.warn(`accept/decline: dailyTask not found id=${id} userId=${user.id}`);
        return;
    }

    const choiceResult = choice === "accept" ? AcceptStatus.accept : AcceptStatus.decline;

    await prisma.dailyTask.update({
        where: { id: dailyTask.id },
        data: { status: choiceResult },
    });

    if (choiceResult === AcceptStatus.accept) {
        await sendMessageOnWhatsapp({ number: user.number, message: "Thanks for Accept the tasks" })
    }

    if (choiceResult === AcceptStatus.decline) {
        await prisma.task.updateMany({
            where: { dailyTaskId: dailyTask.id, userId: user.id },
            data: { finaldecision: TaskFinalStatus.cancelled },
        });

        // Save which declined DailyTask should receive the next text reason from this user.
        pendingDeclineReasonByUserId.set(user.id, dailyTask.id);
        if (pendingDeclineReasonByUserId.size > 1000) {
            const first = pendingDeclineReasonByUserId.keys().next().value;
            if (first) pendingDeclineReasonByUserId.delete(first);
        }

        const msg = reasonMessage("decline", user.name)
        await sendMessageOnWhatsapp({ number: user.number, message: msg })
    }
}

export const handleDeclineReason = async (
    from: string,
    reason: string,
): Promise<boolean> => {
    try {
        const cleanReason = reason.trim();
        if (!cleanReason) return false;

        const user = await findActiveTaskUserByWhatsAppNumber(from);
        if (!user) return false;

        const pendingDailyTaskId = pendingDeclineReasonByUserId.get(user.id);
        if (!pendingDailyTaskId) return false;

        const dailyTask = await prisma.dailyTask.findFirst({
            where: {
                id: pendingDailyTaskId,
                userId: user.id,
                deletedAt: null,
                status: AcceptStatus.decline,
                remarkReason: null,
            },
        });
        if (!dailyTask) return false;

        await prisma.dailyTask.update({
            where: { id: dailyTask.id },
            data: {
                remarkReason: cleanReason,
            },
        });
        pendingDeclineReasonByUserId.delete(user.id);
        return true;
    } catch (error) {
        logger.error(`Error in save Decline reason into database : `, error)
        await notifyAdminError("save Decline reason into database")
        throw new AppError(`Error in save Decline Reason into Database`, error.message)
    }
}

export const sendRemaingstatusTomanager = async (): Promise<RemainingStatusResult> => {
    try {
        const assignDate = getISTTomorrowCalendarDate();

        const managers = await prisma.user.findMany({
            where: { role: Role.manager, deletedAt: null },
            include: {
                children: {
                    where: { deletedAt: null, role: Role.user },
                    select: { id: true, name: true, number: true },
                },
            },
        });

        let sent = 0;
        let skippedNoPhone = 0;
        let skippedNoRemaining = 0;
        let failedSends = 0;

        for (const manager of managers) {
            const childIds = manager.children.map((c) => c.id);
            if (childIds.length === 0) {
                skippedNoRemaining += 1;
                continue;
            }

            const remainingDailyTasks = await prisma.dailyTask.findMany({
                where: {
                    deletedAt: null,
                    date: assignDate,
                    sent: true,
                    status: AcceptStatus.remaining,
                    userId: { in: childIds },
                },
                include: {
                    tasks: {
                        where: { deletedAt: null },
                        select: { name: true },
                    },
                },
            });

            const declinedDailyTasks = await prisma.dailyTask.findMany({
                where: {
                    deletedAt: null,
                    date: assignDate,
                    sent: true,
                    status: AcceptStatus.decline,
                    remarkReason: { not: null },
                    userId: { in: childIds },
                },
                include: {
                    tasks: {
                        where: { deletedAt: null },
                        select: { name: true },
                    },
                },
            });

            if (remainingDailyTasks.length === 0 && declinedDailyTasks.length === 0) {
                skippedNoRemaining += 1;
                continue;
            }

            const childById = new Map(manager.children.map((c) => [c.id, c]));
            const members = remainingDailyTasks
                .map((dt) => {
                    const child = childById.get(dt.userId);
                    if (!child) return null;
                    return {
                        name: child.name,
                        number: child.number,
                        tasks: dt.tasks.map((t) => t.name),
                    };
                })
                .filter((m): m is { name: string; number: string; tasks: string[] } => m !== null);

            const declined = declinedDailyTasks
                .map((dt) => {
                    const child = childById.get(dt.userId);
                    const reason = dt.remarkReason?.trim();
                    if (!child || !reason) return null;
                    return {
                        name: child.name,
                        number: child.number,
                        tasks: dt.tasks.map((t) => t.name),
                        reason,
                    };
                })
                .filter(
                    (m): m is { name: string; number: string; tasks: string[]; reason: string } =>
                        m !== null,
                );

            const managerPhone = manager.number?.trim() ?? "";
            if (!managerPhone) {
                skippedNoPhone += 1;
                continue;
            }

            const body = sendManagerRemainingStatusMessage(manager.name, members, declined);
            const result = await sendMessageOnWhatsapp({ number: managerPhone, message: body });

            if (result.success) {
                sent += 1;
                logger.info(`remaining status sent to manager number=${manager.number}`);
            } else {
                failedSends += 1;
                logger.warn(
                    `remaining status failed for manager number=${manager.number} detail=${result.message}`,
                );
            }
        }

        return {
            success: failedSends === 0 || sent > 0,
            message: `Remaining status: ${sent} manager message(s) sent, ${skippedNoRemaining} with no pending members, ${skippedNoPhone} without phone, ${failedSends} failed.`,
            sent,
            skippedNoPhone,
            skippedNoRemaining,
            failedSends,
        };
    } catch (error) {
        logger.error("Error in send remaing Status to manager", error);
        await notifyAdminError("send remaining status to manager");
        throw new AppError("Error in send Remaing status to manager", error.message);
    }
};

export const finalDecisionDailyTask = async (): Promise<FinalDecisionResult> => {
    try {
        const todayDate = getISTTodayCalendarDate();

        const allDailyTask = await prisma.dailyTask.findMany({
            where: {
                deletedAt: null,
                date: todayDate,
                sent: true,
                status: AcceptStatus.accept,
                finaldecision: null,
                user: { deletedAt: null, role: Role.user },
            },
            include: {
                user: { select: { id: true, name: true, number: true } },
                tasks: {
                    where: { deletedAt: null },
                    select: { name: true },
                },
            },
        });

        let sent = 0;
        let skippedNoPhone = 0;
        let skippedNoTasks = 0;
        let failedSends = 0;

        for (const dailyTask of allDailyTask) {
            if (!dailyTask.tasks.length) {
                skippedNoTasks += 1;
                continue;
            }

            const phone = dailyTask.user.number;
            if (!phone) {
                skippedNoPhone += 1;
                continue;
            }

            const sentOk = await sendMorningOnTrackButtonsForDailyTask(phone, dailyTask);
            if (sentOk) {
                sent += 1;
            } else {
                failedSends += 1;
                logger.warn(`final-decision send failed user num= ${dailyTask.user.number}`);
            }
        }

        return {
            success: failedSends === 0 || sent > 0,
            message: `Final decision: ${sent} sent, ${skippedNoTasks} without tasks, ${skippedNoPhone} without phone, ${failedSends} failed.`,
            sent,
            skippedNoPhone,
            skippedNoTasks,
            failedSends,
        };
    } catch (error) {
        logger.error("Error in FinalDecision update :", error);
        await notifyAdminError("FinalDecision morning on tracking");
        throw new AppError("Error in FinalDecision morning on tracking ", error.message);
    }
};

type MorningOnTrackDailyTask = {
    id: string;
    user: { name: string };
    tasks: { name: string }[];
};

async function sendMorningOnTrackButtonsForDailyTask(
    phone: string,
    dailyTask: MorningOnTrackDailyTask,
): Promise<boolean> {
    const body = finalDecisionMessage(dailyTask.user.name, dailyTask.tasks);
    const buttons = [
        { id: `ontrack_${dailyTask.id}`, title: "on track" },
        { id: `no_${dailyTask.id}`, title: "remark" },
        { id: `absent_${dailyTask.id}`, title: "Absent" },
    ];

    const result = await sendWhatsAppButtons({ number: phone, message: body, buttons });
    return result.success;
}

export async function sendMorningOnTrackButtonsToUser(phone: string): Promise<boolean> {
    const user = await findActiveTaskUserByWhatsAppNumber(phone);
    if (!user) return false;

    const dailyTask = await prisma.dailyTask.findFirst({
        where: {
            deletedAt: null,
            date: getISTTodayCalendarDate(),
            userId: user.id,
            sent: true,
            status: AcceptStatus.accept,
        },
        include: {
            user: { select: { name: true } },
            tasks: {
                where: { deletedAt: null },
                select: { name: true },
            },
        },
    });

    if (dailyTask?.finaldecision === "onTrack") {
        await sendMessageOnWhatsapp({
            number: phone,
            message: "You are already on-track !",
        });
        return false;
    }

    if (!dailyTask?.tasks.length) {
        await sendMessageOnWhatsapp({
            number: phone,
            message: "No morning on track tasks found for today.",
        });
        return false;
    }

    return sendMorningOnTrackButtonsForDailyTask(phone, dailyTask);
}

export const updateFinalDecision = async (id: string, from: string, choice: "ontrack" | "no") => {
    try {
        const user = await findActiveTaskUserByWhatsAppNumber(from);

        if (!user) {
            await sendMessageOnWhatsapp({
                number: from,
                message: "User not found. Please contact your manager.",
            });
            return;
        }

        const dailyTask = await prisma.dailyTask.findFirst({
            where: { id, userId: user.id, deletedAt: null },
        });
        if (!dailyTask) {
            await sendMessageOnWhatsapp({ number: user.number, message: "Daily task not found." });
            return;
        }

        const status = normlizeChoiceforDaily(choice);
        if (!status) {
            await sendMessageOnWhatsapp({ number: user.number, message: "Invalid choice." });
            return;
        }

        const updateDailyTask = await prisma.dailyTask.update({
            where: { id: dailyTask.id },
            data: { finaldecision: status },
        });

        if (updateDailyTask.finaldecision === onTrackStatus.onTrack) {
            await sendMessageOnWhatsapp({
                number: user.number,
                message: "Thank you! Marked as on track.",
            });

            await handlePreviousStartTask(updateDailyTask.id, user.number)

            return;
        }

        if (updateDailyTask.finaldecision === onTrackStatus.remark) {
            await prisma.task.updateMany({
                where: { dailyTaskId: updateDailyTask.id, userId: user.id },
                data: { status: TaskStaus.remark },
            });

            pendingFinalDecisionRemarkByUserId.set(user.id, updateDailyTask.id);
            if (pendingFinalDecisionRemarkByUserId.size > 1000) {
                const first = pendingFinalDecisionRemarkByUserId.keys().next().value;
                if (first) pendingFinalDecisionRemarkByUserId.delete(first);
            }

            const msg = reasonMessage("remark", user.name);
            await sendMessageOnWhatsapp({ number: user.number, message: msg });
        }

        if (updateDailyTask.finaldecision === onTrackStatus.absent) {
            await prisma.task.updateMany({
                where: { dailyTaskId: updateDailyTask.id, userId: user.id },
                data: { finaldecision: TaskFinalStatus.cancelled }
            })

            pendingFinalDecisionAbsentByUserId.set(user.id, updateDailyTask.id);
            if (pendingFinalDecisionAbsentByUserId.size > 1000) {
                const first = pendingFinalDecisionAbsentByUserId.keys().next().value
                if (first) pendingFinalDecisionAbsentByUserId.delete(first)
            }

            const msg = reasonMessage("absent", user.name);
            await sendMessageOnWhatsapp({ number: user.number, message: msg });
        }
    } catch (error) {
        logger.error(`Error in Handle/update finalDecision for daily Task : `, error);
        await notifyAdminError("Handle/update on tracking morning status");
        throw new AppError(`Error in Handle/update on tracking morning status `, error.message);
    }
};

const handlePreviousStartTask = async (did: string, number: string): Promise<boolean> => {
    try {
        const currentTime = new Date()

        const tasks = await prisma.task.findMany({
            where: {
                dailyTaskId: did,
                status: "notSend",
                startAt: { lte: currentTime },
                finaldecision: null,
                deletedAt: null,
            },
            select: {
                id: true,
                position: true,
                name: true,
                rawStartTime: true,
                rawEndTime: true,
                endAt: true,
                status: true
            },
            orderBy: { position: "asc" },
        })

        if (tasks.length === 0) {
            return true
        }

        const startTasks = tasks.filter((t) => t.endAt > currentTime)
        const pastTasks = tasks.filter((t) => t.endAt <= currentTime)

        let success = true
        if (startTasks.length > 0) {
            const result = await sendStartTask(startTasks.map((t) => t.id), "onTime")
            success = result.success
        }
        for (const task of pastTasks) {
            const ok = await sendPreviousTaskFollowupButtons(number, task)
            if (!ok) success = false
        }
        return success
    } catch (error) {
        logger.error(`Error in find Previous Start task : `, error)
        await notifyAdminError("Handle Previous Start Task while user Active later in Morning On-Track")
        return false
    }
}

export const handleFinalDecisionRemarkReason = async (
    from: string,
    reason: string,
): Promise<boolean> => {
    try {
        const cleanReason = reason.trim();
        if (!cleanReason) return false;

        const user = await findActiveTaskUserByWhatsAppNumber(from);
        if (!user) return false;

        const pendingDailyTaskId = pendingFinalDecisionRemarkByUserId.get(user.id);
        if (!pendingDailyTaskId) return false;

        const dailyTask = await prisma.dailyTask.findFirst({
            where: {
                id: pendingDailyTaskId,
                userId: user.id,
                deletedAt: null,
                finaldecision: onTrackStatus.remark,
                remarkReason: null,
            },
        });
        if (!dailyTask) return false;

        await prisma.dailyTask.update({
            where: { id: dailyTask.id },
            data: { remarkReason: cleanReason },
        });

        pendingFinalDecisionRemarkByUserId.delete(user.id);
        await handlePreviousStartTask(pendingDailyTaskId, user.number)

        if (user.parentId) {
            const [manager, tasks] = await Promise.all([
                prisma.user.findFirst({
                    where: { id: user.parentId, role: Role.manager, deletedAt: null },
                }),
                prisma.task.findMany({
                    where: { dailyTaskId: dailyTask.id, deletedAt: null },
                    select: { name: true },
                }),
            ]);

            const managerPhone = manager?.number?.trim() ?? "";
            if (manager && managerPhone) {
                const msg = morningRemarkResontoManager(
                    manager.name,
                    user.name,
                    from,
                    tasks.map((t) => t.name) as [],
                    cleanReason,
                );
                const mgrResult = await sendMessageOnWhatsapp({
                    number: managerPhone,
                    message: msg,
                });
                if (!mgrResult.success) {
                    logger.warn(
                        `final decision remark to manager failed manager=${manager.number} detail=${mgrResult.message}`,
                    );
                }
            }
        }

        return true;
    } catch (error) {
        logger.error("Error in save final decision remark reason", error);
        await notifyAdminError("save final decision remark reason");
        return false;
    }
};

export const handleFinalDecisionAbsentReason = async (from: string, reason: string): Promise<boolean> => {
    try {
        const cleanReason = reason.trim();
        if (!cleanReason) return false;

        const user = await findActiveTaskUserByWhatsAppNumber(from);
        if (!user) return false;

        const pendingDailyTaskId = pendingFinalDecisionAbsentByUserId.get(user.id);
        if (!pendingDailyTaskId) return false;

        const dailyTask = await prisma.dailyTask.findFirst({
            where: {
                id: pendingDailyTaskId,
                userId: user.id,
                deletedAt: null,
                finaldecision: onTrackStatus.absent,
                absentReason: null,
            },
        });
        if (!dailyTask) return false;

        await prisma.dailyTask.update({
            where: { id: dailyTask.id },
            data: { absentReason: cleanReason },
        });

        pendingFinalDecisionAbsentByUserId.delete(user.id);

        if (user.parentId) {
            const [manager, tasks] = await Promise.all([
                prisma.user.findFirst({
                    where: { id: user.parentId, role: Role.manager, deletedAt: null },
                }),
                prisma.task.findMany({
                    where: { dailyTaskId: dailyTask.id, deletedAt: null },
                    select: { name: true },
                }),
            ]);

            const managerPhone = manager?.number?.trim() ?? "";
            if (manager && managerPhone) {
                const msg = morningAbsentResontoManager(
                    manager.name,
                    user.name,
                    from,
                    tasks.map((t) => t.name) as [],
                    cleanReason,
                );
                const mgrResult = await sendMessageOnWhatsapp({
                    number: managerPhone,
                    message: msg,
                });
                if (!mgrResult.success) {
                    logger.warn(
                        `final decision absent to manager failed manager=${manager.number} detail=${mgrResult.message}`,
                    );
                }
            }
        }

        return true;
    } catch (error) {
        logger.error("Error in save final decision Absent reason", error);
        await notifyAdminError("save final decision Absent reason");
        return false;
    }
}