import { AcceptStatus, DelayType, Prisma, Provider, Role, TaskStaus, TaskFinalStatus, onTrackStatus } from "@prisma/client";
import { prisma } from "../../libraries/db";
import logger from "../../libraries/log/logger";
import { excelAssignRowSchema, formatExcelRowZodError, type ExcelAssignRow } from "./request";
import { AppError } from "../../libraries/error-handling/AppError";
import { convertUserTimeToMinutes, parseTimeOnDate, shiftRawTimeByMinutes } from "../../libraries/util/Task/timing";

import { createUserWhatsApp } from "../auth/service";
import { groupAssignTaskSheetRows, normalizeSheetDate, readAssignTaskExcelSheetRows, dedupeIdenticalTasks, type AssignTaskSheetGroup } from "../../libraries/util/Task/readfromxl";
import { sendMessageOnWhatsapp, sendWhatsAppButtons, sendWhatsappTemplate } from "../whtsapp/sendWhatsApp";
import {
    sendAssignTaskMessage,
    formatAssignTaskListForTemplate,
    sendManagerRemainingStatusMessage,
    sendManagerSummaryofAssisgnMessage,
} from "../messages/assignTaskMessages";
import { toStoredIndianWhatsAppNumber } from "../../libraries/util/Task/number";
import { managerFollowUpFailureMessage, managerFollowUpSummaryMessage, taskremarkresontoManager, userFollowUpTaskMessage } from "../messages/followupMessage";
import { startTaskEarlyMessage } from "../messages/startTaskMessage";
import { reasonMessage } from "../messages/reason";
import { normalizeChoiceforTaskfollowUp, normlizeChiocestartChoice, normlizeChoiceforDaily } from "../../libraries/util/Task/status";
import { finalDecisionMessage } from "../../domains/messages/ontrack";
import { morningAbsentResontoManager, morningRemarkResontoManager } from "../messages/morningOntrack";
import { delayinprogressTaskMessagetoManager, delaystartTaskMessagetoManager } from "../messages/delayedTask";
import { resolveTaskPositions } from "../../libraries/util/Task/position";
import { previousTaskmsg } from "../../domains/messages/previousTask";
import {
    formatCalendarDateLabel,
    getISTTodayCalendarDate,
    getISTTomorrowCalendarDate,
    isFutureISTCalendarDate,
} from "../../libraries/util/Task/istDate";
import { notifyAdminError, notifyAdminMessage } from "../../libraries/util/notifyAdminError";

type choices = "inprogress" | "remark" | "done"
type startChoice = "start" | "taskquery" | "delay"
type finalchoice = "blocked" | "completed" | "hold"

const PREVIOUS_TASK_HOLD_REMINDER_MS = 2 * 60 * 60 * 1000

type PreviousTaskFollowupData = {
    id: string;
    position: number;
    name: string;
    rawStartTime: string;
    rawEndTime: string;
};

async function sendPreviousTaskFollowupButtons(
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
        logger.info(`send previousTask follow-up to ${number} task position ${task.position}`)
    } else {
        logger.info(`Error in send previousTask follow-up to ${number} task position ${task.position}`)
    }

    return result.success
}

/** WhatsApp task flows only apply to team members (role user), not managers/admins. */
async function findActiveTaskUserByWhatsAppNumber(number: string) {
    return prisma.user.findFirst({
        where: {
            deletedAt: null,
            number,
            role: Role.user,
        },
    });
}

export type CreateTaskResult = {
    success: boolean;
    status: number;
    message: string;
    processed: number;
    failedRows: { row: number; reason: string }[];
};

export type EditTask = {
    name?: string;
    start?: string;
    end?: string;
};

export type EditTaskResult = {
    success: boolean;
    status: number;
    message?: string;
    error?: string;
    data?: {
        id: string;
        name: string;
        rawStartTime: string;
        rawEndTime: string;
        startAt: Date;
        endAt: Date;
    };
};

export type TaskImportRow = {
    startRow: number;
    date: string;
    name: string;
    number: string;
    email?: string;
    managerName: string;
    managerMobile: string;
    taskName: string;
    rawStartTime: string;
    rawEndTime: string;
};

export type PreviewTaskResult = {
    success: boolean;
    status: number;
    message: string;
    rows: TaskImportRow[];
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

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 10_000;

const delay = (ms: number) => { return new Promise((r) => setTimeout(r, ms)); }
const pendingDeclineReasonByUserId = new Map<string, string>();
const pendingFinalDecisionRemarkByUserId = new Map<string, string>();
const pendingFinalDecisionAbsentByUserId = new Map<string, string>();
const pendingStartTaskDelayTimeByUserId = new Map<string, string>();

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

function processImportWelcomeMessagesInBackground(recipients: WelcomeRecipient[]): void {
    if (recipients.length === 0) {
        return;
    }

    void (async () => {
        let userSuccess = 0;
        let managerSuccess = 0;
        let userFailed = 0;
        let managerFailed = 0;

        for (const recipient of recipients) {
            const isManager = recipient.label === "new manager";

            try {
                const result = await sendWhatsappTemplate({
                    number: recipient.number,
                    tname: "welcome_3m",
                    parameters: [{ parameter_name: "user_name", text: recipient.name }],
                });

                if (result.success) {
                    if (isManager) {
                        managerSuccess += 1;
                    } else {
                        userSuccess += 1;
                    }
                    logger.info(
                        `createTask welcome sent to ${recipient.label} number=${recipient.number}`,
                    );
                } else {
                    if (isManager) {
                        managerFailed += 1;
                    } else {
                        userFailed += 1;
                    }
                    logger.warn(
                        `createTask welcome failed for ${recipient.label} number=${recipient.number} detail=${result.message}`,
                    );
                }
            } catch (err) {
                if (isManager) {
                    managerFailed += 1;
                } else {
                    userFailed += 1;
                }
                logger.error(
                    `createTask welcome error for ${recipient.label} number=${recipient.number}`,
                    err,
                );
            }
        }

        const totalFailed = userFailed + managerFailed;

        if (totalFailed === 0) {
            const lines = [
                `${userSuccess}-user`,
                `${managerSuccess}-manager`,
                "send welcome messages successfully",
            ];
            await notifyAdminMessage(lines.join("\n"));
            return;
        }

        const summaryLines = [
            `${userSuccess}-user`,
            `${managerSuccess}-manager`,
            `welcome failed: ${userFailed} user, ${managerFailed} manager`,
        ];
        await notifyAdminMessage(summaryLines.join("\n"));
        await notifyAdminError("createTask welcome messages");
    })().catch((err) => {
        logger.error("createTask welcome batch failed", err);
        void notifyAdminError("createTask welcome messages");
    });
}

function groupImportRows(flatRows: TaskImportRow[]): AssignTaskSheetGroup[] {
    const map = new Map<string, AssignTaskSheetGroup>();

    for (const row of flatRows) {
        const key = `${row.number}|${row.date}|${row.managerMobile}|${row.name}`;
        const task = {
            name: row.taskName.trim(),
            rawStartTime: row.rawStartTime.trim(),
            rawEndTime: row.rawEndTime.trim(),
        };
        const existing = map.get(key);
        if (existing) {
            existing.tasks.push(task);
            continue;
        }
        map.set(key, {
            startRow: row.startRow,
            name: row.name.trim(),
            number: row.number.replace(/\D/g, ""),
            email: row.email?.trim() ?? "",
            dateRaw: row.date,
            managerName: row.managerName.trim(),
            managerMobile: row.managerMobile.replace(/\D/g, ""),
            tasks: [task],
        });
    }

    return Array.from(map.values()).map((group) => ({
        ...group,
        tasks: dedupeIdenticalTasks(group.tasks),
    }));
}

export function previewTaskImport(buffer: Buffer): PreviewTaskResult {
    const sheetResult = readAssignTaskExcelSheetRows(buffer);
    if (sheetResult.ok === false) {
        return {
            success: false,
            status: sheetResult.status,
            message: sheetResult.message,
            rows: [],
            failedRows: [{ row: 1, reason: sheetResult.message }],
        };
    }

    const groups = groupAssignTaskSheetRows(sheetResult.rows);
    const rows: TaskImportRow[] = [];

    for (const group of groups) {
        const taskDate = normalizeSheetDate(group.dateRaw);
        const dateLabel = taskDate ? formatCalendarDateLabel(taskDate) : "";

        for (const task of group.tasks) {
            rows.push({
                startRow: group.startRow,
                date: dateLabel,
                name: group.name,
                number: group.number,
                email: group.email.trim() ? group.email : undefined,
                managerName: group.managerName,
                managerMobile: group.managerMobile,
                taskName: task.name,
                rawStartTime: task.rawStartTime,
                rawEndTime: task.rawEndTime,
            });
        }
    }

    if (rows.length === 0) {
        return {
            success: false,
            status: 400,
            message: "No tasks found in file",
            rows: [],
            failedRows: [{ row: 1, reason: "No tasks found in file" }],
        };
    }

    return {
        success: true,
        status: 200,
        message: `Found ${rows.length} task row(s). Review and click Create.`,
        rows,
        failedRows: [],
    };
}

type PreparedImportGroup = {
    startRow: number;
    data: ExcelAssignRow;
    storeUserNumber: string;
    storeManagerNumber: string;
    orderedTasks: Array<{
        name: string;
        rawStartTime: string;
        rawEndTime: string;
        startAt: Date;
        endAt: Date;
        position: number;
    }>;
};

type WelcomeRecipient = {
    number: string;
    name: string;
    label: string;
};

function validateImportGroups(groups: AssignTaskSheetGroup[]): {
    prepared: PreparedImportGroup[];
    failedRows: { row: number; reason: string }[];
} {
    const failedRows: { row: number; reason: string }[] = [];
    const prepared: PreparedImportGroup[] = [];

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

        if (!isFutureISTCalendarDate(taskDate)) {
            failedRows.push({
                row: g.startRow,
                reason:
                    `Date must be in the future (not today or past). ` +
                    `Today is ${formatCalendarDateLabel(getISTTodayCalendarDate())} (IST).`,
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
        const storeUserNumber = toStoredIndianWhatsAppNumber(data.number);
        const storeManagerNumber = toStoredIndianWhatsAppNumber(data.managerMobile);

        const tasksWithTime: Array<{
            name: string;
            rawStartTime: string;
            rawEndTime: string;
            startAt: Date;
            endAt: Date;
        }> = [];

        for (const task of data.tasks) {
            const startAt = parseTimeOnDate(data.date, task.rawStartTime);
            const endAt = parseTimeOnDate(data.date, task.rawEndTime);
            if (!startAt || !endAt) {
                failedRows.push({
                    row: g.startRow,
                    reason: `Invalid start/end time for task "${task.name}". Use values like 9am, 11am, 4:25pm, or 16:30.`,
                });
                tasksWithTime.length = 0;
                break;
            }
            tasksWithTime.push({
                name: task.name,
                rawStartTime: task.rawStartTime,
                rawEndTime: task.rawEndTime,
                startAt,
                endAt,
            });
        }

        if (tasksWithTime.length === 0) {
            continue;
        }

        prepared.push({
            startRow: g.startRow,
            data,
            storeUserNumber,
            storeManagerNumber,
            orderedTasks: resolveTaskPositions(tasksWithTime),
        });
    }

    return { prepared, failedRows };
}

async function importTaskGroups(groups: AssignTaskSheetGroup[]): Promise<CreateTaskResult> {
    const { prepared, failedRows } = validateImportGroups(groups);

    if (failedRows.length > 0) {
        return {
            success: false,
            status: 400,
            message: `Validation failed for ${failedRows.length} row(s). No users or tasks were created.`,
            processed: 0,
            failedRows,
        };
    }

    if (prepared.length === 0) {
        return {
            success: false,
            status: 400,
            message: "No rows to import",
            processed: 0,
            failedRows: [{ row: 0, reason: "No rows to import" }],
        };
    }

    const welcomeRecipients: WelcomeRecipient[] = [];
    const welcomedManagers = new Set<string>();

    try {
        await prisma.$transaction(
            async (tx) => {
                const managerByNumber = new Map<string, { id: string; name: string }>();

                for (const item of prepared) {
                    const { data, storeUserNumber, storeManagerNumber, orderedTasks } = item;

                    let managerId = managerByNumber.get(storeManagerNumber)?.id;

                    if (!managerId) {
                        const existingManager = await tx.user.findFirst({
                            where: {
                                number: storeManagerNumber,
                                role: Role.manager,
                                deletedAt: null,
                            },
                        });

                        if (existingManager) {
                            managerId = existingManager.id;
                            managerByNumber.set(storeManagerNumber, {
                                id: existingManager.id,
                                name: existingManager.name,
                            });
                        } else {
                            const createdManager = await tx.user.create({
                                data: {
                                    name: data.managerName,
                                    number: storeManagerNumber,
                                    role: Role.manager,
                                    provider: Provider.whatsapp,
                                },
                            });
                            managerId = createdManager.id;
                            managerByNumber.set(storeManagerNumber, {
                                id: createdManager.id,
                                name: data.managerName,
                            });

                            if (!welcomedManagers.has(storeManagerNumber)) {
                                welcomedManagers.add(storeManagerNumber);
                                welcomeRecipients.push({
                                    number: storeManagerNumber,
                                    name: data.managerName,
                                    label: "new manager",
                                });
                            }
                        }
                    }

                    const existingUser = await tx.user.findFirst({
                        where: {
                            deletedAt: null,
                            role: Role.user,
                            OR: [
                                { number: storeUserNumber },
                                ...(data.email ? [{ email: data.email }] : []),
                            ],
                        },
                    });

                    let userId: string;

                    if (existingUser) {
                        userId = existingUser.id;
                        await tx.user.update({
                            where: { id: existingUser.id },
                            data: { parentId: managerId },
                        });
                    } else {
                        const created = await createUserWhatsApp({
                            name: data.name,
                            number: storeUserNumber,
                            email: data.email,
                            parentId: managerId,
                            tx,
                        });
                        userId = created.id;
                        welcomeRecipients.push({
                            number: storeUserNumber,
                            name: data.name,
                            label: "new user",
                        });
                    }

                    const dayDate = data.date;

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

                    for (const task of orderedTasks) {
                        await tx.task.create({
                            data: {
                                name: task.name,
                                userId,
                                dailyTaskId: dailyTask.id,
                                position: task.position,
                                status: TaskStaus.notSend,
                                rawStartTime: task.rawStartTime,
                                rawEndTime: task.rawEndTime,
                                startAt: task.startAt,
                                endAt: task.endAt,
                            },
                        });
                    }
                }
            },
            {
                maxWait: 10_000,
                timeout: 120_000,
            },
        );
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("createTask import transaction failed", { error: msg });
        return {
            success: false,
            status: 400,
            message: `Import failed. No users or tasks were saved. ${msg}`,
            processed: 0,
            failedRows: [{ row: 0, reason: msg }],
        };
    }

    processImportWelcomeMessagesInBackground(welcomeRecipients);

    return {
        success: true,
        status: 200,
        message: `Imported ${prepared.length} assignment block(s).`,
        processed: prepared.length,
        failedRows: [],
    };
}

export async function createTaskFromImportRows(rows: TaskImportRow[]): Promise<CreateTaskResult> {
    if (rows.length === 0) {
        return {
            success: false,
            status: 400,
            message: "No rows to import",
            processed: 0,
            failedRows: [{ row: 0, reason: "No rows to import" }],
        };
    }
    return importTaskGroups(groupImportRows(rows));
}

export async function createTask(buffer: Buffer): Promise<CreateTaskResult> {
    const preview = previewTaskImport(buffer);
    if (!preview.success) {
        return {
            success: false,
            status: preview.status,
            message: preview.message,
            processed: 0,
            failedRows: preview.failedRows,
        };
    }
    return createTaskFromImportRows(preview.rows);
}

// export const isEditableTask ... (removed — editability checked inside editTask)

export const editTask = async (
    taskId: string,
    data: EditTask,
    adminId: string,
): Promise<EditTaskResult> => {
    try {
        const task = await prisma.task.findFirst({
            where: { id: taskId, deletedAt: null },
            select: {
                startAt: true,
                endAt: true,
                rawStartTime: true,
                rawEndTime: true,
                dailyTask: {
                    select: {
                        date: true,
                    },
                },
            },
        });

        if (!task) {
            return {
                success: false,
                status: 404,
                error: "Task Not Found !",
            };
        }

        const currentTime = new Date();

        if (task.startAt <= currentTime) {
            return {
                success: false,
                status: 400,
                error: "You cannot edit the Past Task !",
            };
        }

        const taskDate = task.dailyTask.date;
        const updateData: Prisma.TaskUpdateInput = {};

        let nextStartAt = task.startAt;
        let nextEndAt = task.endAt;

        if (data.start) {
            const startTime = parseTimeOnDate(taskDate, data.start);
            if (!startTime) {
                return {
                    success: false,
                    status: 400,
                    error: "Invalid start time format",
                };
            }
            if (startTime <= currentTime) {
                return {
                    success: false,
                    status: 400,
                    error: "Start time cannot be in the past",
                };
            }
            updateData.rawStartTime = data.start.trim();
            updateData.startAt = startTime;
            nextStartAt = startTime;
        }

        if (data.end) {
            const endTime = parseTimeOnDate(taskDate, data.end);
            if (!endTime) {
                return {
                    success: false,
                    status: 400,
                    error: "Invalid end time format",
                };
            }
            if (endTime <= currentTime) {
                return {
                    success: false,
                    status: 400,
                    error: "End time cannot be in the past",
                };
            }
            updateData.rawEndTime = data.end.trim();
            updateData.endAt = endTime;
            nextEndAt = endTime;
        }

        if (nextEndAt <= nextStartAt) {
            return {
                success: false,
                status: 400,
                error: "End time must be after start time",
            };
        }

        if (data.name?.trim()) {
            updateData.name = data.name.trim();
        }

        if (Object.keys(updateData).length === 0) {
            return {
                success: false,
                status: 400,
                error: "No fields to update",
            };
        }

        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: { ...updateData, updateById: adminId },
            select: {
                id: true,
                name: true,
                rawStartTime: true,
                rawEndTime: true,
                startAt: true,
                endAt: true,
            },
        });

        return {
            success: true,
            status: 200,
            message: "Task updated successfully",
            data: updatedTask,
        };
    } catch (error) {
        logger.error("Error while update the task ", error);
        await notifyAdminError("Edit task");
        return {
            success: false,
            status: 500,
            error: "Failed to update task",
        };
    }
};

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
                    // Case 1: user never touched us before → send welcome template
                    sendAt = new Date();
                    result = await sendWhatsappTemplate({
                        number: child.number,
                        tname: "welcome_3m",
                        parameters: [{ parameter_name: "user_name", text: child.name }],
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
    const user = await findActiveTaskUserByWhatsAppNumber(whatsappFrom);
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

            const body = finalDecisionMessage(dailyTask.user.name, dailyTask.tasks);
            const buttons = [
                { id: `ontrack_${dailyTask.id}`, title: "on track" },
                { id: `no_${dailyTask.id}`, title: "remark" },
                { id: `absent${dailyTask.id}`, title: "Absent" }
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
        await notifyAdminError("FinalDecision morning on tracking");
        throw new AppError("Error in FinalDecision morning on tracking ", error.message);
    }
};

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

            await handlePreviousStartTask(updateDailyTask.id)

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

const handlePreviousStartTask = async (did: string): Promise<boolean> => {
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
            },
            orderBy: { position: "asc" },
        })

        if (tasks.length === 0) {
            return true
        }

        const result = await sendStartTask(tasks.map((t) => t.id), "onTime")
        return result.success
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
        await handlePreviousStartTask(pendingDailyTaskId)

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
            { manager: { name: string; number: string }; sent: number; userIds: Set<string> }
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
                        data: { sent: true, sendAt },
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
            setPendingFollowUp(user.id, taskId, "remarkReason");
            await sendMessageOnWhatsapp({
                number: user.number,
                message: reasonMessage("remark", user.name),
            });
            return;
        }

        if (choice === TaskStaus.pending) {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: TaskStaus.pending },
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
                manager: { name: string; number: string };
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

        if (choice === TaskFinalStatus.completed) {
            await prisma.task.update({
                where: { id: taskId },
                data: { finaldecision: TaskFinalStatus.completed },
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
            await handleInProgressTask(pending.taskId, phone, clean);
            setPendingFollowUp(user.id, pending.taskId, "extraTime");
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
                status: { in: ["inProgress", "pending", "remark"] },
                finaldecision: null,
                deletedAt: null,
            },
            select: {
                id: true,
                position: true,
                name: true,
                rawStartTime: true,
                rawEndTime: true,
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

const handlePreviousPendingTask = async (from: string, dailyTaskId: string, taskPosition: number): Promise<boolean> => {
    try {
        const currentTime = new Date()

        const tasks = await prisma.task.findMany({
            where: {
                dailyTaskId: dailyTaskId,
                endAt: { lt: currentTime },
                position: { lt: taskPosition },
                status: { in: ["inProgress", "pending", "remark"] },
                finaldecision: null,
                deletedAt: null
            },
            select: {
                id: true,
                position: true,
                name: true,
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
                await prisma.task.update({ where: { id: taskId }, data: { finaldecision: TaskFinalStatus.completed } })
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