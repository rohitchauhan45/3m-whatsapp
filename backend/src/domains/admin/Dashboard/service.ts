import { DailyTask, Prisma, Task, TaskStaus } from "@prisma/client";
import { prisma } from "../../../libraries/db";
import { AppError } from "../../../libraries/error-handling/AppError";
import logger from "../../../libraries/log/logger";
import { convertTimeRangeintoDate } from "../../../libraries/util/Admin/timing";

export type timeRange = "today" | "yesterday" | "thisweek" | "lastweek" | "thismonth" | "lastmonth" | "thisyear"

interface PaginationResult {
    tasks: Task[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

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

        const [ontrack, complete, remark, totaltask] = await Promise.all([
            prisma.task.count({ where: { ...baseWhere, status: "inProgress" } }),
            prisma.task.count({ where: { ...baseWhere, status: "completed" } }),
            prisma.task.count({ where: { ...baseWhere, status: "remark" } }),
            prisma.task.count({
                where: {
                    ...baseWhere, OR: [
                        { status: null },
                        { status: { notIn: ["deleted"] } },
                    ]
                }
            }),
        ])

        const data = {
            ontrack,
            complete,
            remarkTask: remark,
            totalTask: totaltask
        }

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

export const taskTable = async (
    query: { page?: number; limit?: number; search?: string; status?: TaskStaus | "all" | "pending" } = {},
    time: timeRange,
): Promise<PaginationResult> => {
    try {
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
            ...(statusFilter === "all"
                ? {}
                : statusFilter === "pending"
                  ? { status: null }
                  : { status: statusFilter }),
            ...(searchTerm
                ? {
                    OR: [
                        { name: { contains: searchTerm, mode: "insensitive" } },
                        { description: { contains: searchTerm, mode: "insensitive" } },
                    ],
                }
                : {}),
        };

        const [taskRows, total] = await Promise.all([
            prisma.task.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "asc" },
                include: {
                    user: { select: { name: true, number: true } },
                    dailyTask: { select: { date: true } },
                },
            }),
            prisma.task.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        const tasks = taskRows.map(({ dailyTask, ...taskRow }) => ({
            ...taskRow,
            date: dailyTask.date,
        }));

        return {
            tasks: tasks as (Task & { date: Date })[],
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        };
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