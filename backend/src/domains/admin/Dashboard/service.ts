import { DailyTask, Prisma, Task, TaskStaus } from "@prisma/client";
import { prisma } from "../../../libraries/db";
import { AppError } from "../../../libraries/error-handling/AppError";
import logger from "../../../libraries/log/logger";
import { convertTimeRangeintoDate } from "../../../libraries/util/Admin/timing";

export type timeRange = "today" | "yesterday" | "thisweek" | "lastweek" | "thismonth" | "lastmonth" | "thisyear"

interface PaginationResult {
    tasks: (Task & { date: Date })[];
    groupedByUser?: TaskTableUserGroup[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export type TaskTableUserTask = {
    id: string;
    name: string;
    description: string | null;
    rawStartTime: string;
    rawEndTime: string;
    startAt: Date;
    endAt: Date;
    status: TaskStaus;
    remarkReason: string | null;
    howmuchComplete: string | null;
    actualTime: string | null;
    extratTme: number | null;
    totalTime: string | null;
    sent: boolean;
    sendAt: Date | null;
    date: Date;
};

export type TaskTableUserGroup = {
    userId: string;
    name: string;
    number: string;
    tasks: TaskTableUserTask[];
};

interface UserTablePaginationResult {
    dailyTasks: DailyTask[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export type UserStatusFilter = "all" | "accept" | "remaining" | "decline";

function buildUserTableStatusWhere(
    statusFilter: UserStatusFilter
): Prisma.DailyTaskWhereInput {
    switch (statusFilter) {
        case "all":
            return {};
        case "accept":
            return { status: "accept" };
        case "decline":
            return { status: "decline" };
        case "remaining":
            return { OR: [{ status: "remaining" }, { status: null }] };
        default:
            return { OR: [{ status: "remaining" }, { status: null }] };
    }
}

export const taskCardDetails = async (time: timeRange) => {
    try {
        const dateFilter = convertTimeRangeintoDate(time);
        const baseWhere: Prisma.TaskWhereInput = {
            deletedAt: null,
            startAt: dateFilter,
            dailyTask: {
                deletedAt: null,
            },
        }

        const [inProgress, delayed, complete, remark, cancelled, totaltask] = await Promise.all([
            prisma.task.count({
                where: {
                    ...baseWhere,
                    status: { in: [TaskStaus.inProgress] },
                },
            }),
            prisma.task.count({
                where: { ...baseWhere, extratTme: { not: null, gt: 0 } },
            }),
            prisma.task.count({ where: { ...baseWhere, status: TaskStaus.completed } }),
            prisma.task.count({ where: { ...baseWhere, status: TaskStaus.remark } }),
            prisma.task.count({ where: { ...baseWhere, status: TaskStaus.cancelled } }),
            prisma.task.count({
                where: {
                    ...baseWhere,
                    OR: [{ status: { notIn: [TaskStaus.deleted] } }],
                },
            }),
        ]);

        const data = {
            inProgress,
            delayedTask: delayed,
            complete,
            remarkTask: remark,
            cancelledTask: cancelled,
            totalTask: totaltask,
        };

        return {
            status: 200,
            message: "Dashboard card summary get successfully",
            data,
        }

    } catch (error) {
        logger.error("Error in Admin-Dashboard detalis !", error)
        throw new AppError("Internal server Error while Fetch Dashboard summary", error.message)
    }
};

export type TaskTableStatusFilter = TaskStaus | "all" | "pending" | "delayed" | "inprogress";

function buildTaskTableStatusWhere(
    statusFilter: TaskTableStatusFilter,
): Prisma.TaskWhereInput {
    if (statusFilter === "all") return {};
    if (statusFilter === "pending") return { status: TaskStaus.notSend };
    if (statusFilter === "delayed") return { extratTme: { not: null, gt: 0 } };
    if (statusFilter === "inprogress") {
        return { status: { in: [TaskStaus.inProgress] } };
    }
    return { status: statusFilter };
}

function buildTaskTableSearchWhere(searchTerm: string): Prisma.TaskWhereInput {
    return {
        OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { description: { contains: searchTerm, mode: "insensitive" } },
            {
                user: {
                    deletedAt: null,
                    OR: [
                        { name: { contains: searchTerm, mode: "insensitive" } },
                        { number: { contains: searchTerm, mode: "insensitive" } },
                    ],
                },
            },
        ],
    };
}

async function taskTableGroupedByUser(
    query: { page?: number; limit?: number; search?: string; status?: TaskTableStatusFilter },
    time: timeRange,
): Promise<PaginationResult> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const searchTerm = query.search?.trim() || "";
    const dateFilter = convertTimeRangeintoDate(time);
    const statusFilter = query.status ?? "remark";

    const where: Prisma.TaskWhereInput = {
        deletedAt: null,
        dailyTask: {
            deletedAt: null,
            date: dateFilter,
        },
        ...buildTaskTableStatusWhere(statusFilter),
        ...(searchTerm ? buildTaskTableSearchWhere(searchTerm) : {}),
    };

    const taskRows = await prisma.task.findMany({
        where,
        orderBy: [{ user: { name: "asc" } }, { startAt: "asc" }],
        include: {
            user: { select: { id: true, name: true, number: true } },
            dailyTask: { select: { date: true } },
        },
    });

    const groupMap = new Map<string, TaskTableUserGroup>();

    for (const { dailyTask, user, ...taskRow } of taskRows) {
        const existing = groupMap.get(taskRow.userId);
        const taskItem: TaskTableUserTask = {
            id: taskRow.id,
            name: taskRow.name,
            description: taskRow.description,
            rawStartTime: taskRow.rawStartTime,
            rawEndTime: taskRow.rawEndTime,
            startAt: taskRow.startAt,
            endAt: taskRow.endAt,
            status: taskRow.status,
            remarkReason: taskRow.remarkReason,
            extratTme: taskRow.extratTme,
            howmuchComplete: taskRow.howmuchComplete,
            actualTime: taskRow.actualTime,
            totalTime: taskRow.totalTime,
            sent: taskRow.sent,
            sendAt: taskRow.sendAt,
            date: dailyTask.date,
        };

        if (existing) {
            existing.tasks.push(taskItem);
        } else {
            groupMap.set(taskRow.userId, {
                userId: taskRow.userId,
                name: user.name,
                number: user.number,
                tasks: [taskItem],
            });
        }
    }

    const allGroups = Array.from(groupMap.values());
    const total = allGroups.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const groupedByUser = allGroups.slice(skip, skip + limit);

    return {
        tasks: [],
        groupedByUser,
        pagination: { page, limit, total, totalPages },
    };
}

export const taskTable = async (
    query: { page?: number; limit?: number; search?: string; status?: TaskTableStatusFilter } = {},
    time: timeRange,
): Promise<PaginationResult> => {
    try {
        return await taskTableGroupedByUser(query, time);
    } catch (error) {
        logger.error("Error in fetch task table Details !", error);
        throw new AppError("Internal server Error while fetch the Task Table Details", error.message);
    }
};

export const userCardDetails = async (time: timeRange) => {
    try {
        const dateFilter = convertTimeRangeintoDate(time);
        const dailyTaskBase: Prisma.DailyTaskWhereInput = {
            deletedAt: null,
            date: dateFilter,
        };

        const [accept, decline, attented, usersInRange] = await Promise.all([
            prisma.dailyTask.count({ where: { ...dailyTaskBase, status: "accept" } }),
            prisma.dailyTask.count({ where: { ...dailyTaskBase, status: "decline" } }),
            prisma.attendence.count({
                where: {
                    type: "morning",
                    deletedAt: null,
                    createdAt: dateFilter,
                },
            }),
            prisma.dailyTask.findMany({
                where: dailyTaskBase,
                select: { userId: true },
                distinct: ["userId"],
            }),
        ]);

        const data = {
            accept,
            decline,
            attented,
            totaluser: usersInRange.length,
        };

        return {
            status: 200,
            message: "Successfully fetch the user Details",
            data,
        };
    } catch (error) {
        logger.error("Error in fetch user dailyTask Details", error);
        throw new AppError("Internal server Error while fetch user detalis for Dashboard", error.message);
    }
};

export const usertable = async (
    query: { page?: number; limit?: number; search?: string; status?: UserStatusFilter } = {},
    time: timeRange,
): Promise<UserTablePaginationResult> => {
    try {
        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;

        const searchTerm = query.search?.trim() || "";
        const dateFilter = convertTimeRangeintoDate(time);
        const statusFilter = query.status ?? "remaining";

        const where: Prisma.DailyTaskWhereInput = {
            deletedAt: null,
            date: dateFilter,
            ...buildUserTableStatusWhere(statusFilter),
            ...(searchTerm
                ? {
                    user: {
                        deletedAt: null,
                        OR: [
                            { name: { contains: searchTerm, mode: "insensitive" } },
                            { number: { contains: searchTerm, mode: "insensitive" } },
                        ],
                    },
                }
                : {}),
        };

        const [dailyTasks, total] = await Promise.all([
            prisma.dailyTask.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "asc" },
                include: {
                    user: { select: { name: true, number: true } },
                },
            }),
            prisma.dailyTask.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            dailyTasks: dailyTasks as DailyTask[],
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    } catch (error) {
        logger.error("Error in fetch the dailyTask details for the Admin", error);
        throw new AppError(
            "Internal server Error while fetcht the user-table data for Dashboard",
            error.message,
        );
    }
};