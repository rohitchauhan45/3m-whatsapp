import { TaskFinalStatus, TaskStaus } from "@prisma/client";
import XLSX from "xlsx";
import { prisma } from "../../../libraries/db";
import { AppError } from "../../../libraries/error-handling/AppError";
import logger from "../../../libraries/log/logger";
import { convertTimeRangeintoDate } from "../../../libraries/util/Admin/timing";
import { notifyAdminError } from "../../../libraries/util/notifyAdminError";
import {
    addCalendarDays,
    formatCalendarDateLabel,
    getISTTodayCalendarDate,
    getUTCDateParts,
} from "../../../libraries/util/Task/istDate";
import { normalizeSheetDate } from "../../../libraries/util/Task/readfromxl";
import type { timeRange } from "../Dashboard/service";

const REPORT_HEADER_LABELS = [
    "date",
    "name",
    "user-status",
    "absent reason",
    "number",
    "task",
    "start",
    "end",
    "delay time",
    "task-status",
    "reason",
    "managerName",
    "manager mobile",
] as const;

function capitalizeHeader(label: string): string {
    if (!label) return label;
    return label.charAt(0).toUpperCase() + label.slice(1);
}

const REPORT_HEADERS = REPORT_HEADER_LABELS.map((label) => capitalizeHeader(label));
const EMPTY_ROW = Array(REPORT_HEADERS.length).fill("");

type ReportGroup = {
    dateLabel: string;
    name: string;
    number: string;
    managerName: string;
    managerMobile: string;
    userStatus: string;
    absentReason: string;
    dailyRemarkReason: string;
    tasks: {
        name: string;
        rawStartTime: string;
        rawEndTime: string;
        extratTme: number | null;
        status: TaskStaus;
        finaldecision: TaskFinalStatus | null;
        remarkReason: string | null;
    }[];
};

function taskCalendarDateKey(date: Date): string {
    const { y, m, d } = getUTCDateParts(date);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatReportTaskStatus(
    status: TaskStaus,
    finaldecision: TaskFinalStatus | null,
): string {
    const value = finaldecision ?? status;
    if (value === TaskStaus.notSend) return "not send";
    if (value === TaskStaus.pending) return "pending";
    if (value === TaskStaus.inProgress) return "in progress";
    if (value === TaskStaus.delayed) return "delayed";
    if (value === TaskStaus.remark) return "remark";
    if (value === TaskStaus.hold) return "hold";
    if (value === TaskFinalStatus.completed) return "completed";
    if (value === TaskFinalStatus.cancelled) return "cancelled";
    if (value === TaskFinalStatus.blocked) return "blocked";
    return String(value);
}

function formatDelayTime(extraMinutes: number | null): string {
    if (extraMinutes == null || extraMinutes <= 0) return "";
    return `${extraMinutes}min`;
}

function formatUserStatus(status: string | null): string {
    if (!status) return "remaining";
    return status;
}

async function fetchReportGroups(time: timeRange): Promise<ReportGroup[]> {
    const dateFilter = convertTimeRangeintoDate(time);

    const taskRows = await prisma.task.findMany({
        where: {
            deletedAt: null,
            dailyTask: {
                deletedAt: null,
                date: dateFilter,
            },
        },
        orderBy: [{ user: { name: "asc" } }, { startAt: "asc" }],
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    number: true,
                    parent: { select: { name: true, number: true } },
                },
            },
            dailyTask: {
                select: {
                    date: true,
                    status: true,
                    absentReason: true,
                    remarkReason: true,
                },
            },
        },
    });

    const groupMap = new Map<string, ReportGroup>();

    for (const row of taskRows) {
        const dateKey = taskCalendarDateKey(row.dailyTask.date);
        const groupKey = `${row.userId}|${dateKey}`;
        const existing = groupMap.get(groupKey);

        const taskItem = {
            name: row.name,
            rawStartTime: row.rawStartTime,
            rawEndTime: row.rawEndTime,
            extratTme: row.extratTme,
            status: row.status,
            finaldecision: row.finaldecision,
            remarkReason: row.remarkReason,
        };

        if (existing) {
            existing.tasks.push(taskItem);
            continue;
        }

        groupMap.set(groupKey, {
            dateLabel: formatCalendarDateLabel(row.dailyTask.date),
            name: row.user.name,
            number: row.user.number,
            managerName: row.user.parent?.name ?? "",
            managerMobile: row.user.parent?.number ?? "",
            userStatus: formatUserStatus(row.dailyTask.status),
            absentReason: row.dailyTask.absentReason ?? "",
            dailyRemarkReason: row.dailyTask.remarkReason ?? "",
            tasks: [taskItem],
        });
    }

    return Array.from(groupMap.values());
}

function buildReportRows(groups: ReportGroup[]): unknown[][] {
    const rows: unknown[][] = [[...REPORT_HEADERS]];

    for (const group of groups) {
        group.tasks.forEach((task, index) => {
            const reason =
                task.remarkReason ?? (index === 0 ? group.dailyRemarkReason : "") ?? "";

            if (index === 0) {
                rows.push([
                    group.dateLabel,
                    group.name,
                    group.userStatus,
                    group.absentReason,
                    group.number,
                    task.name,
                    task.rawStartTime,
                    task.rawEndTime,
                    formatDelayTime(task.extratTme),
                    formatReportTaskStatus(task.status, task.finaldecision),
                    reason,
                    group.managerName,
                    group.managerMobile,
                ]);
            } else {
                rows.push([
                    "",
                    "",
                    "",
                    "",
                    "",
                    task.name,
                    task.rawStartTime,
                    task.rawEndTime,
                    formatDelayTime(task.extratTme),
                    formatReportTaskStatus(task.status, task.finaldecision),
                    reason,
                    "",
                    "",
                ]);
            }
        });

        rows.push([...EMPTY_ROW]);
    }

    return rows;
}

function resolveReportDateLabel(time: timeRange): string {
    const calendarDate = normalizeSheetDate(time);
    if (calendarDate) {
        return formatCalendarDateLabel(calendarDate);
    }

    const todayStart = getISTTodayCalendarDate();

    switch (time) {
        case "today":
            return formatCalendarDateLabel(todayStart);
        case "yesterday":
            return formatCalendarDateLabel(addCalendarDays(todayStart, -1));
        case "tomorrow":
            return formatCalendarDateLabel(addCalendarDays(todayStart, 1));
        default:
            return formatCalendarDateLabel(todayStart);
    }
}

export function reportFilename(time: timeRange): string {
    return `report_${resolveReportDateLabel(time)}.xlsx`;
}

export async function generateTaskReportXlsx(time: timeRange): Promise<Buffer> {
    try {
        const groups = await fetchReportGroups(time);
        const sheetRows = buildReportRows(groups);
        const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    } catch (error) {
        logger.error("generateTaskReportXlsx error", error);
        await notifyAdminError("generate task report");
        throw new AppError("Failed to generate task report", (error as Error).message, 500);
    }
}
