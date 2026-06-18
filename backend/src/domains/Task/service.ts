import { AcceptStatus, Provider, Role, TaskStaus, onTrackStatus } from "@prisma/client";
import { prisma } from "../../libraries/db";
import logger from "../../libraries/log/logger";
import { excelAssignRowSchema, formatExcelRowZodError } from "./request";
import { AppError } from "../../libraries/error-handling/AppError";
import { convertUserTimeToHour, parseTimeOnDate } from "../../libraries/util/Task/timing";

import { createUserWhatsApp } from "../auth/service";
import { groupAssignTaskSheetRows, normalizeSheetDate, readAssignTaskExcelSheetRows, } from "../../libraries/util/Task/readfromxl";
import { sendMessageOnWhatsapp, sendWhatsAppButtons } from "../whtsapp/sendWhatsApp";
import {
    sendAssignTaskMessage,
    sendManagerRemainingStatusMessage,
    sendManagerSummaryofAssisgnMessage,
} from "../messages/assignTaskMessages";
import { ensureIndiaCountryCode91 } from "../../libraries/util/Task/number";
import { managerFollowUpSummaryMessage, userFollowUpTaskMessage } from "../messages/followupMessage";
import { reasonMessage } from "../messages/reason";
import { normalizeChoiceforTaskfollowUp, normlizeChiocestartChoice, normlizeChoiceforDaily } from "../../libraries/util/Task/status";
import { finalDecisionMessage } from "../../domains/messages/ontrack";

type choices = "inprogress" | "remark" | "done"
type startChoice = "start" | "taskquery"

export type CreateTaskResult = {
    success: boolean;
    status: number;
    message: string;
    processed: number;
    failedRows: { row: number; reason: string }[];
};

export type TaskResult = {
    success: boolean;
    status: number;
    message: string;
    sent: number;
    skippedNoPhone: number;
    skippedNoTasks: number;
    failedSends: number;
    managerSummarySent: boolean;
};

export type RemainingStatusResult = {
    success: boolean;
    message: string;
    sent: number;
    skippedNoPhone: number;
    skippedNoRemaining: number;
    failedSends: number;
};

export type FinalDecisionResult = {
    success: boolean;
    message: string;
    sent: number;
    skippedNoPhone: number;
    skippedNoTasks: number;
    failedSends: number;
};

const startOfCalendarDay = (d: Date): Date => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 10_000;

const delay = (ms: number) => { return new Promise((r) => setTimeout(r, ms)); }
const pendingDeclineReasonByUserId = new Map<string, string>();
const pendingFinalDecisionRemarkByUserId = new Map<string, string>();

type FollowUpPendingStep = "howMuchComplete" | "extraTime" | "remarkReason";
const FOLLOW_UP_PENDING_TTL_MS = 30 * 60 * 1000;

const pendingFollowUpByUserId = new Map<
    string,
    { taskId: string; step: FollowUpPendingStep; expiresAt: number }
>();

const pruneExpiredFollowUpPending = (now = Date.now()): void => {
    for (const [userId, entry] of pendingFollowUpByUserId.entries()) {
        if (entry.expiresAt <= now) pendingFollowUpByUserId.delete(userId);
    }
}

const setPendingFollowUp = (userId: string, taskId: string, step: FollowUpPendingStep): void => {
    pruneExpiredFollowUpPending();
    pendingFollowUpByUserId.set(userId, {
        taskId,
        step,
        expiresAt: Date.now() + FOLLOW_UP_PENDING_TTL_MS,
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

/** Webhook calls this when user taps Accept or Decline on the task WhatsApp message. */
export async function createTask(buffer: Buffer): Promise<CreateTaskResult> {
    const failedRows: { row: number; reason: string }[] = [];
    let processed = 0;

    const sheetResult = readAssignTaskExcelSheetRows(buffer);
    if (sheetResult.ok === false) {
        return {
            success: false,
            status: sheetResult.status,
            message: sheetResult.message,
            processed: 0,
            failedRows: [{ row: 1, reason: sheetResult.message }],
        };
    }
    const sheet = sheetResult;

    const groups = groupAssignTaskSheetRows(sheet.rows);

    for (const g of groups) {
        const taskDate = normalizeSheetDate(g.dateRaw);
        if (!taskDate) {
            failedRows.push({
                row: g.startRow,
                reason:
                    'Column **date** missing or not parsed. Put the date once at the top of the sheet (or on the user row). ' +
                    "Use format like `30-05-2026` or a real Excel date cell.",
            });
            continue;
        }

        const parsed = excelAssignRowSchema.safeParse({
            date: taskDate,
            name: g.name,
            number: g.number,
            email: g.email.trim() ? g.email : undefined,
            managerName: g.managerName,
            managerMobile: g.managerMobile,
            tasks: g.tasks,
        });

        if (!parsed.success) {
            failedRows.push({ row: g.startRow, reason: formatExcelRowZodError(parsed.error) });
            continue;
        }

        const data = parsed.data;
        const storeUserNumber = ensureIndiaCountryCode91(data.number);
        const storeManagerNumber = ensureIndiaCountryCode91(data.managerMobile);

        try {
            await prisma.$transaction(async (tx) => {
                let manager = await tx.user.findFirst({
                    where: {
                        number: storeManagerNumber,
                        role: Role.manager,
                        deletedAt: null,
                    },
                });

                if (!manager) {
                    manager = await tx.user.create({
                        data: {
                            name: data.managerName,
                            number: storeManagerNumber,
                            role: Role.manager,
                            provider: Provider.whatsapp,
                        },
                    });
                }

                const existingUser = await tx.user.findFirst({
                    where: {
                        deletedAt: null,
                        OR: [
                            { number: storeUserNumber },
                            { number: data.number },
                            ...(data.email ? [{ email: data.email }] : []),
                        ],
                    },
                });

                let userId: string;

                if (existingUser) {
                    userId = existingUser.id;
                    await tx.user.update({
                        where: { id: existingUser.id },
                        data: { parentId: manager.id },
                    });
                } else {
                    const created = await createUserWhatsApp({
                        name: data.name,
                        number: storeUserNumber,
                        email: data.email,
                        parentId: manager.id,
                        tx,
                    });
                    userId = created.id;
                }

                const dayDate = startOfCalendarDay(data.date);

                let dailyTask = await tx.dailyTask.findFirst({
                    where: {
                        userId,
                        date: dayDate,
                        deletedAt: null,
                    },
                });

                if (!dailyTask) {
                    dailyTask = await tx.dailyTask.create({
                        data: {
                            userId,
                            date: dayDate,
                        },
                    });
                }

                for (const task of data.tasks) {
                    const startAt = parseTimeOnDate(data.date, task.rawStartTime);
                    const endAt = parseTimeOnDate(data.date, task.rawEndTime);
                    if (!startAt || !endAt) {
                        throw new Error(
                            `Invalid start/end time for task "${task.name}". Use values like 9am, 11am, 4:25pm, or 16:30.`
                        );
                    }
                    await tx.task.create({
                        data: {
                            name: task.name,
                            userId,
                            dailyTaskId: dailyTask.id,
                            rawStartTime: task.rawStartTime,
                            rawEndTime: task.rawEndTime,
                            startAt,
                            endAt,
                        },
                    });
                }
            });
            processed += 1;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error(`createTask import failed at sheet row ${g.startRow}`, { name: g.name, error: msg });
            failedRows.push({ row: g.startRow, reason: msg });
        }
    }

    const allOk = failedRows.length === 0;
    return {
        success: allOk,
        status: allOk ? 200 : processed > 0 ? 200 : 400,
        message: allOk
            ? `Imported ${processed} assignment block(s).`
            : `Done: ${processed} ok, ${failedRows.length} failed. See failedRows.`,
        processed,
        failedRows,
    };
}

export const assignTask = async (managerId?: string): Promise<TaskResult> => {
    try {
        const managers = await prisma.user.findMany({
            where: {
                ...(managerId ? { id: managerId } : {}),
                role: Role.manager,
                deletedAt: null,
            },
            include: {
                children: {
                    where: { deletedAt: null },
                    include: {
                        Dailytask: {
                            where:
                            {
                                deletedAt: null,
                                sent: false,
                                sendAt: null
                            },
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
                    logger.info(`assign-task skip userId=${child.id} name=${child.name}: no open tasks`);
                    continue;
                }

                const phone = child.number ? ensureIndiaCountryCode91(child.number) : "";
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

                const body = sendAssignTaskMessage(
                    child.name,
                    dailyTask.tasks.map((t) => ({ name: t.name, endAt: t.endAt })),
                );
                const sendAt = new Date();

                const result = await sendWhatsAppButtons({
                    number: phone,
                    message: body,
                    buttons: [{
                        title: "Accept",
                        id: `accept_${dailyTask.id}`
                    }, {
                        title: "Decline",
                        id: `decline_${dailyTask.id}`
                    }]
                });

                if (result.success) {
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
            const managerPhone = manager.number ? ensureIndiaCountryCode91(manager.number) : "";
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
            message: `Processed ${totalUsers} team member(s): ${sent} message thread(s) sent, ${skippedNoTasks} without tasks, ${skippedNoPhone} without phone, ${failedSends} send error(s). Manager summary: ${managerSummarySent ? "sent" : "not sent"}.`,
            sent,
            skippedNoPhone,
            skippedNoTasks,
            failedSends,
            managerSummarySent,
        };
    } catch (error) {
        logger.error("Error in Assign task : ", error)
        throw new AppError(`Error in Assign task to user`, error.message)
    }

};

export const updateTaskAcceptFromWhatsApp = async (
    id: string,
    whatsappFrom: string,
    choice: "accept" | "decline",
): Promise<void> => {
    const user = await prisma.user.findFirst({
        where: {
            deletedAt: null,
            number: whatsappFrom,
        },
    });
    if (!user) {
        logger.info(`Daily Task no user for from=${whatsappFrom}`);
        return;
    }

    const choiceResult = choice === "accept" ? AcceptStatus.accept : AcceptStatus.decline;

    const dailyTask = await prisma.dailyTask.update({
        where: { id },
        data: {
            status: choiceResult
        }
    })

    if (choiceResult === AcceptStatus.accept) {
        await sendMessageOnWhatsapp({ number: user.number, message: "Thanks for Accept the tasks" })
    }

    if (choiceResult === AcceptStatus.decline) {
        await prisma.task.updateMany({
            where: { dailyTaskId: dailyTask.id, userId: user.id },
            data: { status: TaskStaus.cancelled },
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

export const sendRemaingstatusTomanager = async (): Promise<RemainingStatusResult> => {
    try {
        const managers = await prisma.user.findMany({
            where: { role: Role.manager, deletedAt: null },
            include: {
                children: {
                    where: { deletedAt: null },
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

            if (remainingDailyTasks.length === 0) {
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

            const managerPhone = manager.number ? ensureIndiaCountryCode91(manager.number) : "";
            if (!managerPhone) {
                skippedNoPhone += 1;
                continue;
            }

            const body = sendManagerRemainingStatusMessage(manager.name, members);
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
        throw new AppError("Error in send Remaing status to manager", error.message);
    }
};

export const finalDecisionDailyTask = async (): Promise<FinalDecisionResult> => {
    try {
        const allDailyTask = await prisma.dailyTask.findMany({
            where: {
                deletedAt: null,
                sent: true,
                status: AcceptStatus.accept,
                finaldecision: null,
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

            const body = finalDecisionMessage(dailyTask.user.name, dailyTask.tasks);
            const buttons = [
                { id: `ontrack_${dailyTask.id}`, title: "on track" },
                { id: `no_${dailyTask.id}`, title: "remark" },
            ];

            const result = await sendWhatsAppButtons({ number: phone, message: body, buttons });
            if (result.success) {
                sent += 1;
            } else {
                failedSends += 1;
                logger.warn(
                    `final-decision send failed user num= ${dailyTask.user.number} detail=${result.message}`
                );
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
        throw new AppError("Error in FinalDecision morning on tracking ", error.message);
    }
};

export const updateFinalDecision = async (id: string, from: string, choice: "ontrack" | "no") => {
    try {
        const user = await prisma.user.findFirst({
            where: { deletedAt: null, number: from },
        });

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
            return;
        }

        if (updateDailyTask.finaldecision === onTrackStatus.remark) {
            await prisma.task.updateMany({
                where: { dailyTaskId: updateDailyTask.id, userId: user.id },
                data: { status: TaskStaus.cancelled },
            });

            pendingFinalDecisionRemarkByUserId.set(user.id, updateDailyTask.id);
            if (pendingFinalDecisionRemarkByUserId.size > 1000) {
                const first = pendingFinalDecisionRemarkByUserId.keys().next().value;
                if (first) pendingFinalDecisionRemarkByUserId.delete(first);
            }

            const msg = reasonMessage("remark", user.name);
            await sendMessageOnWhatsapp({ number: user.number, message: msg });
        }
    } catch (error) {
        logger.error(`Error in Handle/update finalDecision for daily Task : `, error);
        throw new AppError(`Error in Handle/update on tracking morning status `, error.message);
    }
};

export const handleFinalDecisionRemarkReason = async (
    from: string,
    reason: string,
): Promise<boolean> => {
    try {
        const cleanReason = reason.trim();
        if (!cleanReason) return false;

        const user = await prisma.user.findFirst({
            where: { deletedAt: null, number: from },
        });
        if (!user) return false;

        const pendingDailyTaskId = pendingFinalDecisionRemarkByUserId.get(user.id);
        if (!pendingDailyTaskId) return false;

        const dailyTask = await prisma.dailyTask.findFirst({
            where: {
                id: pendingDailyTaskId,
                userId: user.id,
                deletedAt: null,
                finaldecision: onTrackStatus.remark,
                notAttentReason: null,
            },
        });
        if (!dailyTask) return false;

        await prisma.dailyTask.update({
            where: { id: dailyTask.id },
            data: { notAttentReason: cleanReason },
        });
        pendingFinalDecisionRemarkByUserId.delete(user.id);
        return true;
    } catch (error) {
        logger.error("Error in save final decision remark reason", error);
        return false;
    }
};

export const handleDeclineReason = async (
    from: string,
    reason: string,
): Promise<boolean> => {
    try {
        const cleanReason = reason.trim();
        if (!cleanReason) return false;

        const user = await prisma.user.findFirst({
            where: {
                deletedAt: null,
                number: from,
            },
        });
        if (!user) return false;

        const pendingDailyTaskId = pendingDeclineReasonByUserId.get(user.id);
        if (!pendingDailyTaskId) return false;

        const dailyTask = await prisma.dailyTask.findFirst({
            where: {
                id: pendingDailyTaskId,
                userId: user.id,
                deletedAt: null,
                status: AcceptStatus.decline,
                notAttentReason: null,
            },
        });
        if (!dailyTask) return false;

        await prisma.dailyTask.update({
            where: { id: dailyTask.id },
            data: {
                notAttentReason: cleanReason,
            },
        });
        pendingDeclineReasonByUserId.delete(user.id);
        return true;
    } catch (error) {
        logger.error(`Error in save Decline reason into database : `, error)
        throw new AppError(`Error in save Decline Reason into Database`, error.message)
    }
}

export const sendStartTask = async (taskIds: string[]): Promise<TaskResult> => {
    try {
        if (taskIds.length === 0) {
            return {
                success: true,
                status: 200,
                message: "start task: no tasks due this minute.",
                sent: 0,
                skippedNoPhone: 0,
                skippedNoTasks: 0,
                failedSends: 0,
                managerSummarySent: false,
            };
        }

        const tasks = await prisma.task.findMany({
            where: { id: { in: taskIds }, deletedAt: null },
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

        const managerStats = new Map<
            string,
            { manager: { name: string; number: string }; sent: number; userIds: Set<string> }
        >();

        for (const task of tasks) {
            const phone = task.user.number ? ensureIndiaCountryCode91(task.user.number) : "";
            if (!phone) {
                skippedNoPhone += 1;
                continue;
            }

            const result = await sendWhatsAppButtons({
                number: phone,
                message: userFollowUpTaskMessage(task),
                buttons: [
                    { title: "On Track", id: `start_${task.id}` },
                    { title: "Remark", id: `taskquery_${task.id}` },
                ],
            });

            if (result.success) {
                sent += 1;
                await prisma.task.update({
                    where: { id: task.id },
                    data: { sent: true, sendAt },
                });
                logger.info(`start-task sent user =${task.user.number}`);

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
            } else {
                failedSends += 1;
                logger.warn(
                    `start-task failed to user number=${task.user.number} detail=${result.message}`,
                );
            }
        }

        let managerSummarySent = false;
        for (const { manager, sent: mgrSent, userIds } of managerStats.values()) {
            if (mgrSent === 0) continue;

            const managerPhone = manager.number ? ensureIndiaCountryCode91(manager.number) : "";
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
                logger.info(`start-task manager summary sent managerId=${manager.number}`);
            } else {
                logger.warn(
                    `start-task manager summary failed manager number=${manager.number} detail=${mgrResult.message}`,
                );
            }
        }

        return {
            success: failedSends === 0 || sent > 0,
            status: sent === 0 && taskIds.length > 0 ? 502 : 200,
            message: `start-task: ${sent} sent, ${skippedNoPhone} without phone, ${failedSends} failed (${taskIds.length} due task(s)). Manager summary: ${managerSummarySent ? "sent" : "not sent"}.`,
            sent,
            skippedNoPhone,
            skippedNoTasks: 0,
            failedSends,
            managerSummarySent,
        };
    } catch (error) {
        logger.error("error in send start task ", error)
        throw new AppError("internal server Error while send start task", error.message)
    }
}

export const handleStarttaskStatus = async (taskId: string, whatsappFrom: string, ch: startChoice) => {
    try {
        const user = await prisma.user.findFirst({
            where: {
                deletedAt: null,
                number: whatsappFrom,
            },
        });

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

        if (choice === TaskStaus.onTrack) {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: TaskStaus.onTrack },
            });
            await sendMessageOnWhatsapp({
                number: user.number,
                message:
                    "Thanks for update !",
            });
            return;
        }

        if (choice === TaskStaus.remark) {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: TaskStaus.remark },
            });
            setPendingFollowUp(user.id, taskId, "remarkReason");
            await sendMessageOnWhatsapp({
                number: user.number,
                message: reasonMessage("remark", user.name),
            });
            return;
        }

    } catch (error) {
        logger.error("Error in handle start task status", error)
        throw new AppError("Internal server Error while handle the start task Status", error.message)
    }
}

/** Manager sends follow-up for the given task ids (due now — ids resolved in scheduler / API). */
export const sendTaskFollowUp = async (taskIds: string[]): Promise<TaskResult> => {
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
            where: { id: { in: taskIds }, deletedAt: null },
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

        const managerStats = new Map<
            string,
            { manager: { name: string; number: string }; sent: number; userIds: Set<string> }
        >();

        for (const task of tasks) {
            const phone = task.user.number ? ensureIndiaCountryCode91(task.user.number) : "";
            if (!phone) {
                skippedNoPhone += 1;
                continue;
            }

            const result = await sendWhatsAppButtons({
                number: phone,
                message: userFollowUpTaskMessage(task),
                buttons: [
                    { title: "in Progress", id: `inprogress_${task.id}` },
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
            } else {
                failedSends += 1;
                logger.warn(
                    `task-follow-up failed to user number=${task.user.number} detail=${result.message}`,
                );
            }
        }

        let managerSummarySent = false;
        for (const { manager, sent: mgrSent, userIds } of managerStats.values()) {
            if (mgrSent === 0) continue;

            const managerPhone = manager.number ? ensureIndiaCountryCode91(manager.number) : "";
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
                logger.info(`task follow-up manager summary sent managerId=${manager.number}`);
            } else {
                logger.warn(
                    `task follow-up manager summary failed manager number=${manager.number} detail=${mgrResult.message}`,
                );
            }
        }

        return {
            success: failedSends === 0 || sent > 0,
            status: sent === 0 && taskIds.length > 0 ? 502 : 200,
            message: `Follow-up: ${sent} sent, ${skippedNoPhone} without phone, ${failedSends} failed (${taskIds.length} due task(s)). Manager summary: ${managerSummarySent ? "sent" : "not sent"}.`,
            sent,
            skippedNoPhone,
            skippedNoTasks: 0,
            failedSends,
            managerSummarySent,
        };
    } catch (error) {
        logger.error("Error in Give follow-up : ", error);
        throw new AppError(`Error in get Follow-up task : `, error.message);
    }
};

export const handleFollowUp = async (taskId: string, whatsappFrom: string, ch: choices) => {
    try {
        const user = await prisma.user.findFirst({
            where: {
                deletedAt: null,
                number: whatsappFrom,
            },
        });

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
            setPendingFollowUp(user.id, taskId, "howMuchComplete");
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
            setPendingFollowUp(user.id, taskId, "remarkReason");
            await sendMessageOnWhatsapp({
                number: user.number,
                message: reasonMessage("remark", user.name),
            });
            return;
        }

        if (choice === TaskStaus.completed) {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: TaskStaus.completed },
            });
            clearPendingFollowUp(user.id);
            await sendMessageOnWhatsapp({
                number: user.number,
                message: "Thank you! Task marked as done.",
            });
        }
    } catch (error) {
        logger.error(`Error in handle Follow-up Task`, error);
        throw new AppError(`Error in handle follow-up Task`, error.message);
    }
};

/** Next text from user after follow-up buttons (in progress / remark). */
export const handleFollowUpReply = async (whatsappFrom: string, text: string): Promise<boolean> => {
    try {
        const clean = text.trim();
        if (!clean) return false;

        const user = await prisma.user.findFirst({
            where: {
                deletedAt: null,
                number: whatsappFrom,
            },
        });
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
            await handleInProgressTask(pending.taskId, phone, clean);
            setPendingFollowUp(user.id, pending.taskId, "extraTime");
            return true;
        }

        if (pending.step === "extraTime") {
            const saved = await updateExtraTime(pending.taskId, phone, clean);
            if (saved) clearPendingFollowUp(user.id);
            return true;
        }

        if (pending.step === "remarkReason") {
            await prisma.task.update({
                where: { id: pending.taskId },
                data: { remarkReason: clean },
            });
            clearPendingFollowUp(user.id);
            await sendMessageOnWhatsapp({
                number: phone,
                message: "Thank you! Remark reason saved.",
            });
            return true;
        }

        return false;
    } catch (error) {
        logger.error("Error in handle follow-up reply", error);
        return false;
    }
};

export const handleInProgressTask = async (taskId: string, phone: string, answer: string) => {
    await prisma.task.update({
        where: { id: taskId },
        data: { howmuchComplete: answer.trim() },
    });

    await sendMessageOnWhatsapp({
        number: phone,
        message:
            "How much more time do you need to complete this task? (e.g. 1hour, 1.5hour, 1kalak, 10min, 2kalak)",
    });
};

export const updateExtraTime = async (
    taskId: string,
    phone: string,
    time: string,
): Promise<boolean> => {
    const resultTime = convertUserTimeToHour(time);
    if (!resultTime) {
        await sendMessageOnWhatsapp({
            number: phone,
            message: "Invalid time. Please send again (e.g. 1hour, 30min, 1kalak).",
        });
        return false;
    }

    await prisma.task.update({
        where: { id: taskId },
        data: { extratTme: resultTime },
    });

    await sendMessageOnWhatsapp({
        number: phone,
        message: "Thank you! Extra time saved.",
    });
    return true;
};