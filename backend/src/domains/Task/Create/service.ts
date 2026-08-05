import { Prisma, Provider, Role, TaskStaus } from "@prisma/client";
import { prisma } from "../../../libraries/db";
import logger from "../../../libraries/log/logger";
import { excelAssignRowSchema, formatExcelRowZodError, type ExcelAssignRow } from "../request";
import { AppError } from "../../../libraries/error-handling/AppError";
import { parseTimeOnDate } from "../../../libraries/util/Task/timing";
import { createUserWhatsApp } from "../../auth/service";
import {
    groupAssignTaskSheetRows,
    normalizeSheetDate,
    readAssignTaskExcelSheetRows,
    dedupeIdenticalTasks,
    type AssignTaskSheetGroup,
} from "../../../libraries/util/Task/readfromxl";
import { sendWhatsappTemplate } from "../../whtsapp/sendWhatsApp";
import { toStoredIndianWhatsAppNumber } from "../../../libraries/util/Task/number";
import { resolveTaskPositions } from "../../../libraries/util/Task/position";
import {
    formatCalendarDateLabel,
    getISTTodayCalendarDate,
    isFutureISTCalendarDate,
} from "../../../libraries/util/Task/istDate";
import { notifyAdminError, notifyAdminMessage } from "../../../libraries/util/notifyAdminError";
import type {
    CreateTaskResult,
    EditTask,
    EditTaskResult,
    PreviewTaskResult,
    SendWelcomeMsgResult,
    TaskImportRow,
} from "../types";

function sendWelcomeMsgInBackground(): void {
    void sendWelcomeMsg().catch((err) => {
        logger.error("sendWelcomeMsg background job failed", err);
        void notifyAdminError("sendWelcomeMsg");
    });
}
export async function sendWelcomeMsg(): Promise<SendWelcomeMsgResult> {
    const pending = await prisma.user.findMany({
        where: {
            deletedAt: null,
            isWelcomemsgSend: false,
            role: { in: [Role.user, Role.manager] },
        },
        select: {
            id: true,
            name: true,
            number: true,
            role: true,
        },
        orderBy: { createdAt: "asc" },
    });

    if (pending.length === 0) {
        return {
            success: true,
            status: 200,
            message: "No pending welcome messages",
            userSent: 0,
            managerSent: 0,
            userFailed: 0,
            managerFailed: 0,
        };
    }

    let userSent = 0;
    let managerSent = 0;
    let userFailed = 0;
    let managerFailed = 0;

    for (const person of pending) {
        const phone = person.number?.trim() ?? "";
        if (!phone) {
            if (person.role === Role.manager) {
                managerFailed += 1;
            } else {
                userFailed += 1;
            }
            logger.warn(`sendWelcomeMsg skip ${person.role} id=${person.id}: no phone number`);
            continue;
        }

        const isManager = person.role === Role.manager;

        try {
            const result = await sendWhatsappTemplate({
                number: phone,
                tname: "welcome_3m",
                parameters: [{ parameter_name: "user_name", text: person.name }],
            });

            if (result.success) {
                await prisma.user.update({
                    where: { id: person.id },
                    data: { isWelcomemsgSend: true },
                });

                if (isManager) {
                    managerSent += 1;
                } else {
                    userSent += 1;
                }
                logger.info(`sendWelcomeMsg sent to ${person.role} number=${phone}`);
            } else {
                if (isManager) {
                    managerFailed += 1;
                } else {
                    userFailed += 1;
                }
                logger.warn(
                    `sendWelcomeMsg failed for ${person.role} number=${phone} detail=${result.message}`,
                );
            }
        } catch (err) {
            if (isManager) {
                managerFailed += 1;
            } else {
                userFailed += 1;
            }
            logger.error(`sendWelcomeMsg error for ${person.role} number=${phone}`, err);
        }
    }

    const totalFailed = userFailed + managerFailed;

    if (userSent + managerSent > 0 && totalFailed === 0) {
        await notifyAdminMessage(
            [`${userSent}-user`, `${managerSent}-manager`, "send welcome messages successfully"].join(
                "\n",
            ),
        );
    } else if (userSent + managerSent > 0) {
        await notifyAdminMessage(
            [
                `${userSent}-user`,
                `${managerSent}-manager`,
                `welcome failed: ${userFailed} user, ${managerFailed} manager`,
            ].join("\n"),
        );
        await notifyAdminError("sendWelcomeMsg");
    } else if (totalFailed > 0) {
        await notifyAdminError("sendWelcomeMsg");
    }

    return {
        success: totalFailed === 0,
        status: totalFailed === 0 ? 200 : 500,
        message:
            totalFailed === 0
                ? `Welcome messages sent (${userSent} user, ${managerSent} manager).`
                : `Welcome messages partially failed (${userFailed} user, ${managerFailed} manager).`,
        userSent,
        managerSent,
        userFailed,
        managerFailed,
    };
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
    const sheetResult = readAssignTaskExcelSheetRows(buffer, { mode: "draft" });
    if (sheetResult.ok === false) {
        return {
            success: false,
            status: sheetResult.status,
            message: sheetResult.message,
            rows: [],
            failedRows: [{ row: 1, reason: sheetResult.message }],
        };
    }

    const groups = groupAssignTaskSheetRows(sheetResult.rows, { mode: "draft" });
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
            if (endAt.getTime() <= startAt.getTime()) {
                failedRows.push({
                    row: g.startRow,
                    reason:
                        `End time must be after start time for task "${task.name}" ` +
                        `(start ${task.rawStartTime}, end ${task.rawEndTime}).`,
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

    sendWelcomeMsgInBackground();

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
    const sheetResult = readAssignTaskExcelSheetRows(buffer, { mode: "full" });
    if (sheetResult.ok === false) {
        return {
            success: false,
            status: sheetResult.status,
            message: sheetResult.message,
            processed: 0,
            failedRows: [{ row: 1, reason: sheetResult.message }],
        };
    }

    const groups = groupAssignTaskSheetRows(sheetResult.rows, { mode: "full" });
    return importTaskGroups(groups);
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
