import { prisma } from "../../libraries/db";
import { AppError } from "../../libraries/error-handling/AppError";
import logger from "../../libraries/log/logger";
import { isValidCron } from "cron-validator";
import { readCronjob } from "../../scheduler";
import { isMinuteSettingName, parsePositiveMinutes } from "../../constants/cronSettings";
import { Role } from "@prisma/client";
import { notifyAdminError } from "../../libraries/util/notifyAdminError";
import {
    addCalendarDays,
    formatCalendarDateLabel,
    getISTCalendarParts,
    getISTTodayCalendarDate,
    getISTTomorrowCalendarDate,
    getUTCDateParts,
} from "../../libraries/util/Task/istDate";

function taskCalendarDateKey(date: Date): string {
    const { y, m, d } = getUTCDateParts(date);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function istTodayKey(now = new Date()): string {
    const { y, m, d } = getISTCalendarParts(now);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function istYesterdayKey(now = new Date()): string {
    const yesterday = addCalendarDays(getISTTodayCalendarDate(now), -1);
    return taskCalendarDateKey(yesterday);
}

function istTomorrowKey(now = new Date()): string {
    return taskCalendarDateKey(getISTTomorrowCalendarDate(now));
}

function calendarDayLabel(dateKey: string, dateLabel: string, now = new Date()): string {
    if (dateKey === istTodayKey(now)) return "Today";
    if (dateKey === istYesterdayKey(now)) return "Yesterday";
    if (dateKey === istTomorrowKey(now)) return "Tomorrow";
    return dateLabel;
}

interface cronjobData {
    name: string,
    time: string,
    adminId: string
}

export type ManagerTasksResult = {
    success: boolean;
    status: number;
    message: string;
    days: {
        date: string;
        label: string;
        taskCount: number;
        tasks: {
            id: string;
            name: string;
            status: string;
            completedByTime: string;
            user: { id: string; name: string; number: string };
        }[];
    }[];
};

export const getAllTasksByDate = async () => {
    try {
        const tasks = await prisma.task.findMany({
            where: {
                deletedAt: null,
                dailyTask: { deletedAt: null },
            },
            orderBy: { startAt: "asc" },
            include: {
                dailyTask: { select: { date: true } },
                user: {
                    select: {
                        id: true,
                        name: true,
                        number: true,
                        parent: { select: { id: true, name: true } },
                    },
                },
            },
        });

        const dayMap = new Map<string, {
            taskDate: Date;
            tasks: typeof tasks;
            users: Set<string>;
            managers: Set<string>;
        }>();

        for (const task of tasks) {
            const dateKey = taskCalendarDateKey(task.dailyTask.date);
            if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, {
                    taskDate: task.dailyTask.date,
                    tasks: [],
                    users: new Set(),
                    managers: new Set(),
                });
            }
            const day = dayMap.get(dateKey)!;
            day.tasks.push(task);
            day.users.add(task.user.id);
            if (task.user.parent) day.managers.add(task.user.parent.id);
        }

        const days = Array.from(dayMap.values())
            .sort((a, b) => taskCalendarDateKey(b.taskDate).localeCompare(taskCalendarDateKey(a.taskDate)))
            .map((d) => {
                const dateKey = taskCalendarDateKey(d.taskDate);
                const dateLabel = formatCalendarDateLabel(d.taskDate);
                return {
                    date: dateLabel,
                    label: calendarDayLabel(dateKey, dateLabel),
                    taskCount: d.tasks.length,
                    userCount: d.users.size,
                    managerCount: d.managers.size,
                    tasks: d.tasks.map((t) => ({
                        id: t.id,
                        name: t.name,
                        status: t.status,
                        completedByTime: t.endAt.toISOString(),
                        userName: t.user.name,
                        managerName: t.user.parent?.name || "—",
                    })),
                };
            });

        return { success: true, status: 200, message: "OK", days };
    } catch (error: any) {
        logger.error("getAllTasksByDate error", error);
        await notifyAdminError("get all tasks by date");
        throw new AppError("Failed to get tasks", error.message, 500);
    }
};

export async function getManagerTasks(managerId: string): Promise<ManagerTasksResult> {
    const manager = await prisma.user.findFirst({
        where: { id: managerId, role: Role.manager, deletedAt: null },
        include: {
            children: {
                where: { deletedAt: null },
                include: {
                    tasks: {
                        where: {
                            deletedAt: null,
                            dailyTask: { deletedAt: null },
                        },
                        include: { dailyTask: { select: { date: true } } },
                        orderBy: { startAt: "asc" },
                    },
                },
            },
        },
    });

    if (!manager) {
        return { success: false, status: 404, message: "Manager not found", days: [] };
    }

    const tasksByDay = new Map<string, {
        taskDate: Date;
        tasks: ManagerTasksResult["days"][number]["tasks"];
    }>();

    for (const child of manager.children) {
        for (const task of child.tasks) {
            const dateKey = taskCalendarDateKey(task.dailyTask.date);
            if (!tasksByDay.has(dateKey)) {
                tasksByDay.set(dateKey, { taskDate: task.dailyTask.date, tasks: [] });
            }
            tasksByDay.get(dateKey)!.tasks.push({
                id: task.id,
                name: task.name,
                status: task.status,
                completedByTime: task.endAt.toISOString(),
                user: { id: child.id, name: child.name, number: child.number },
            });
        }
    }

    const days = Array.from(tasksByDay.values())
        .sort((a, b) => taskCalendarDateKey(b.taskDate).localeCompare(taskCalendarDateKey(a.taskDate)))
        .map((entry) => {
            const dateKey = taskCalendarDateKey(entry.taskDate);
            const dateLabel = formatCalendarDateLabel(entry.taskDate);
            return {
                date: dateLabel,
                label: calendarDayLabel(dateKey, dateLabel),
                taskCount: entry.tasks.length,
                tasks: entry.tasks,
            };
        });

    return { success: true, status: 200, message: "OK", days };
}

export const getAllManagers = async () => {
    try {
        const managers = await prisma.user.findMany({
            where: { role: "manager", deletedAt: null },
            include: {
                children: {
                    where: { deletedAt: null },
                    select: { id: true },
                },
                _count: {
                    select: {
                        children: { where: { deletedAt: null } },
                    },
                },
            },
        });

        const data = managers.map((m) => ({
            id: m.id,
            name: m.name,
            number: m.number,
            email: m.email,
            userCount: m._count.children,
            createdAt: m.createdAt,
        }));

        return {
            success: true,
            status: 200,
            message: "Managers fetched successfully",
            data,
        };
    } catch (error: any) {
        logger.error("getting manager Error !", error);
        await notifyAdminError("get all managers");
        throw new AppError("Failed to get All Managers", error.message, 500);
    }
};

export const getAllCronjobs = async () => { 
    try {
        const crons = await prisma.cron.findMany({ orderBy: { name: "asc" } });

        const cronMap = new Map<string, typeof crons[0]>();
        for (const c of crons) {
            const key = c.name;
            const existing = cronMap.get(key);
            if (!existing || existing.id.startsWith("default_")) {
                cronMap.set(key, c);
            }
        }

        return { success: true, status: 200, message: "Cronjobs fetched", data: Array.from(cronMap.values()) };
    } catch (error: any) {
        logger.error("getAllCronjobs error", error);
        await notifyAdminError("get all cronjobs");
        throw new AppError("Failed to get cronjobs", error.message, 500);
    }
};

export const updateAdminCronjob = async (id: string, data: cronjobData) => {
    try {
        const { name, time, adminId } = data;
        let normalizedTime = time.trim();

        if (isMinuteSettingName(name)) {
            const minutes = parsePositiveMinutes(normalizedTime, 0);
            if (minutes <= 0) {
                return {
                    success: false,
                    status: 400,
                    message: "Enter a positive number of minutes (e.g. 10, 20, 30)",
                };
            }
            normalizedTime = String(minutes);
        } else if (!isValidCron(normalizedTime)) {
            return { success: false, status: 400, message: `Invalid cron expression: ${normalizedTime}` };
        }

        if (id.startsWith("default_")) {
            const adminCron = await prisma.cron.findFirst({
                where: { name, NOT: { id: { startsWith: "default_" } } },
            });

            if (adminCron) {
                const updated = await prisma.cron.update({
                    where: { id: adminCron.id },    
                    data: { time: normalizedTime, updateById: adminId },
                });
                await readCronjob();
                return {
                    success: true,
                    status: 200,
                    message: isMinuteSettingName(name)
                        ? `Setting updated to ${normalizedTime} minutes`
                        : `Schedule updated to: ${normalizedTime}`,
                    data: updated,
                };
            }

            const created = await prisma.cron.create({
                data: { name, time: normalizedTime, updateById: adminId },
            });
            await readCronjob();
            return {
                success: true,
                status: 200,
                message: isMinuteSettingName(name)
                    ? `Setting updated to ${normalizedTime} minutes`
                    : `Schedule updated to: ${normalizedTime}`,
                data: created,
            };
        }

        const updated = await prisma.cron.update({
            where: { id },
            data: { time: normalizedTime, updateById: adminId },
        });

        await readCronjob();

        return {
            success: true,
            status: 200,
            message: isMinuteSettingName(name)
                ? `Setting updated to ${normalizedTime} minutes`
                : `Schedule updated to: ${normalizedTime}`,
            data: updated,
        };
    } catch (error: any) {
        logger.error("Error in Update Cronjob", error);
        await notifyAdminError("update cronjob");
        throw new AppError("Error updating cronjob", error.message, 500);
    }
}