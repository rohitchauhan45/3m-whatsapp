import { prisma } from "../../libraries/db";
import { AppError } from "../../libraries/error-handling/AppError";
import logger from "../../libraries/log/logger";
import { isValidCron } from "cron-validator";
import { readCronjob } from "../../scheduler";
import { Role } from "@prisma/client";

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
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            include: {
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
            date: string;
            tasks: typeof tasks;
            users: Set<string>;
            managers: Set<string>;
        }>();

        for (const task of tasks) {
            const dateKey = task.createdAt.toISOString().slice(0, 10);
            if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, { date: dateKey, tasks: [], users: new Set(), managers: new Set() });
            }
            const day = dayMap.get(dateKey)!;
            day.tasks.push(task);
            day.users.add(task.user.id);
            if (task.user.parent) day.managers.add(task.user.parent.id);
        }

        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

        const formatDate = (iso: string) => {
            const dt = new Date(iso);
            return `${dt.getDate()}-${dt.toLocaleString("en", { month: "short" }).toLowerCase()}`;
        };

        const days = Array.from(dayMap.values())
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((d) => ({
                date: formatDate(d.date),
                label: d.date === today ? "Today" : d.date === yesterday ? "Yesterday" : formatDate(d.date),
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
            }));

        return { success: true, status: 200, message: "OK", days };
    } catch (error: any) {
        logger.error("getAllTasksByDate error", error);
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
                        where: { deletedAt: null },
                        orderBy: { createdAt: "desc" },
                    },
                },
            },
        },
    });

    if (!manager) {
        return { success: false, status: 404, message: "Manager not found", days: [] };
    }

    const tasksByDay = new Map<string, ManagerTasksResult["days"][number]["tasks"]>();

    for (const child of manager.children) {
        for (const task of child.tasks) {
            const dateKey = task.createdAt.toISOString().slice(0, 10);
            if (!tasksByDay.has(dateKey)) tasksByDay.set(dateKey, []);
            tasksByDay.get(dateKey)!.push({
                id: task.id,
                name: task.name,
                status: task.status,
          
                completedByTime: task.endAt.toISOString(),
                user: { id: child.id, name: child.name, number: child.number },
            });
        }
    }

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const days = Array.from(tasksByDay.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, tasks]) => ({
            date,
            label: date === today ? "Today" : date === yesterday ? "Yesterday" : date,
            taskCount: tasks.length,
            tasks,
        }));

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
        throw new AppError("Failed to get cronjobs", error.message, 500);
    }
};

export const updateAdminCronjob = async (id: string, data: cronjobData) => {
    try {
        const { name, time, adminId } = data;

        if (!isValidCron(time)) {
            return { success: false, status: 400, message: `Invalid cron expression: ${time}` };
        }

        if (id.startsWith("default_")) {
            const adminCron = await prisma.cron.findFirst({
                where: { name, NOT: { id: { startsWith: "default_" } } },
            });

            if (adminCron) {
                const updated = await prisma.cron.update({
                    where: { id: adminCron.id },    
                    data: { time, updateById: adminId },
                });
                await readCronjob();
                return {
                    success: true,
                    status: 200,
                    message: `Schedule updated to: ${time}`,
                    data: updated,
                };
            }

            const created = await prisma.cron.create({
                data: { name, time, updateById: adminId },
            });
            await readCronjob();
            return {
                success: true,
                status: 200,
                message: `Schedule updated to: ${time}`,
                data: created,
            };
        }

        const updated = await prisma.cron.update({
            where: { id },
            data: { time, updateById: adminId },
        });

        await readCronjob();

        return {
            success: true,
            status: 200,
            message: `Schedule updated to: ${time}`,
            data: updated,
        };
    } catch (error: any) {
        logger.error("Error in Update Cronjob", error);
        throw new AppError("Error updating cronjob", error.message, 500);
    }
};
