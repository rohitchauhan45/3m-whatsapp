import { NextFunction, Request, Response, Router } from "express";
import { AppError } from "../../../libraries/error-handling/AppError";
import { authenticateToken, requireAdmin } from "../../../middlewares/jwt";
import { normalizeSheetDate } from "../../../libraries/util/Task/readfromxl";
import type { PresetTimeRange } from "../Dashboard/service";
import { generateTaskReportXlsx, reportFilename } from "./service";

const TIME_RANGES: PresetTimeRange[] = [
    "today",
    "tomorrow",
    "yesterday",
    "thisweek",
    "lastweek",
    "thismonth",
    "lastmonth",
    "thisyear",
];

function parseTimeRange(raw: unknown): PresetTimeRange | string {
    const value = String(raw ?? "today").trim();
    if (TIME_RANGES.includes(value as PresetTimeRange)) {
        return value as PresetTimeRange;
    }
    if (normalizeSheetDate(value)) {
        return value;
    }
    throw new AppError(
        "Validation error",
        `Invalid time range. Use: ${TIME_RANGES.join(", ")} or DD-MM-YYYY`,
        400,
    );
}

export const routes = (): Router => {
    const router = Router();

    router.get(
        "/tasks",
        authenticateToken,
        requireAdmin,
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const time = parseTimeRange(req.query.time);
                const buffer = await generateTaskReportXlsx(time);
                const filename = reportFilename(time);

                res.setHeader(
                    "Content-Type",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                );
                res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
                return res.status(200).send(buffer);
            } catch (error) {
                next(error);
            }
        },
    );

    return router;
};
