import { NextFunction, Request, Response, Router } from "express";
import { AppError } from "../../../libraries/error-handling/AppError";
import { authenticateToken, requireAdmin } from "../../../middlewares/jwt";
import {
    taskCardDetails,
    taskTable,
    userCardDetails,
    usertable,
    type timeRange,
    type UserStatusFilter,
} from "./service";
import { TaskStaus } from "@prisma/client";

const TIME_RANGES: timeRange[] = [
    "today",
    "yesterday",
    "thisweek",
    "lastweek",
    "thismonth",
    "lastmonth",
    "thisyear",
];

function parseTimeRange(raw: unknown): timeRange {
    const value = String(raw ?? "today").trim() as timeRange;
    if (!TIME_RANGES.includes(value)) {
        throw new AppError("Validation error", `Invalid time range. Use: ${TIME_RANGES.join(", ")}`, 400);
    }
    return value;
}

function parseTaskStatusFilter(raw: unknown): TaskStaus | "all" | "pending" | undefined {
    if (typeof raw !== "string" || !raw.trim()) return undefined;
    const value = raw.trim().toLowerCase();
    if (value === "all") return "all";
    if (value === "remark") return TaskStaus.remark;
    if (value === "completed" || value === "complete") return TaskStaus.completed;
    if (value === "cancelled") return TaskStaus.cancelled;
    if (value === "ontrack" || value === "inprogress") return TaskStaus.inProgress;
    if (value === "pending") return "pending";
    throw new AppError(
        "Validation error",
        "Invalid status. Use: all, remark, ontrack, pending, completed, cancelled",
        400
    );
}

function parseUserStatusFilter(raw: unknown): UserStatusFilter | undefined {
    if (typeof raw !== "string" || !raw.trim()) return undefined;
    const value = raw.trim().toLowerCase();
    if (value === "all") return "all";
    if (value === "accept") return "accept";
    if (value === "remaining") return "remaining";
    if (value === "decline") return "decline";
    throw new AppError(
        "Validation error",
        "Invalid status. Use: all, accept, remaining, decline",
        400
    );
}

export const routes = (): Router => {
    const router = Router();

    router.get(
        "/task-cards",
        authenticateToken,
        requireAdmin,
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const result = await taskCardDetails(parseTimeRange(req.query.time));
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.get(
        "/task-table",
        authenticateToken,
        requireAdmin,
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const page = req.query.page ? Number(req.query.page) : 1;
                const limit = req.query.limit ? Number(req.query.limit) : 10;
                const search = typeof req.query.search === "string" ? req.query.search : undefined;
                const status = parseTaskStatusFilter(req.query.status);
                const result = await taskTable(
                    { page, limit, search, status },
                    parseTimeRange(req.query.time)
                );
                return res.status(200).json({ success: true, status: 200, ...result });
            } catch (error) {
                next(error);
            }
        },
    );

    router.get(
        "/user-cards",
        authenticateToken,
        requireAdmin,
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const result = await userCardDetails(parseTimeRange(req.query.time));
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.get(
        "/user-table",
        authenticateToken,
        requireAdmin,
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const page = req.query.page ? Number(req.query.page) : 1;
                const limit = req.query.limit ? Number(req.query.limit) : 10;
                const search = typeof req.query.search === "string" ? req.query.search : undefined;
                const status = parseUserStatusFilter(req.query.status);
                const result = await usertable(
                    { page, limit, search, status },
                    parseTimeRange(req.query.time)
                );
                return res.status(200).json({ success: true, status: 200, ...result });
            } catch (error) {
                next(error);
            }
        },
    );

    return router;
};
