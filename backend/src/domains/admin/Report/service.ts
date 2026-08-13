import { TaskFinalStatus, TaskStaus } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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

export type ReportFileFormat = "xlsx" | "pdf";

export function reportFilename(time: timeRange, format: ReportFileFormat = "xlsx"): string {
    return `report_${resolveReportDateLabel(time)}.${format}`;
}

function cellText(value: unknown): string {
    if (value == null) return "";
    return String(value).replace(/[^\u0020-\u007E]/g, "?");
}

function wrapCellText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const cleaned = text.trim();
    if (!cleaned) return [""];

    const words = cleaned.split(/\s+/);
    const lines: string[] = [];
    let current = "";

    const pushWord = (word: string) => {
        if (font.widthOfTextAtSize(word, size) <= maxWidth) {
            current = word;
            return;
        }
        let chunk = "";
        for (const char of word) {
            const next = `${chunk}${char}`;
            if (font.widthOfTextAtSize(next, size) <= maxWidth) {
                chunk = next;
            } else {
                if (chunk) lines.push(chunk);
                chunk = char;
            }
        }
        current = chunk;
    };

    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) {
            current = next;
            continue;
        }
        if (current) lines.push(current);
        pushWord(word);
    }

    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
}

const PDF_COL_WIDTHS = [62, 70, 58, 70, 68, 110, 42, 42, 48, 62, 90, 70, 72];
const PDF_FONT_SIZE = 7;
const PDF_HEADER_SIZE = 8;
const PDF_LINE_HEIGHT = 10;
const PDF_MARGIN = 28;

async function generateTaskReportPdfBuffer(groups: ReportGroup[], time: timeRange): Promise<Buffer> {
    const rows = buildReportRows(groups);
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [842, 595];
    const usableWidth = pageSize[0] - PDF_MARGIN * 2;
    const widthScale = usableWidth / PDF_COL_WIDTHS.reduce((sum, width) => sum + width, 0);
    const colWidths = PDF_COL_WIDTHS.map((width) => width * widthScale);

    let page = doc.addPage(pageSize);
    let y = pageSize[1] - PDF_MARGIN;

    const drawTitle = (target: PDFPage) => {
        target.drawText(`Task Report  ${resolveReportDateLabel(time)}`, {
            x: PDF_MARGIN,
            y: y - 4,
            size: 13,
            font: bold,
            color: rgb(0.12, 0.16, 0.22),
        });
        y -= 22;
    };

    const addPage = () => {
        page = doc.addPage(pageSize);
        y = pageSize[1] - PDF_MARGIN;
        drawTitle(page);
    };

    const drawRow = (values: unknown[], header: boolean) => {
        const cellLines = values.map((value, index) =>
            wrapCellText(cellText(value), header ? bold : font, header ? PDF_HEADER_SIZE : PDF_FONT_SIZE, colWidths[index] - 6),
        );
        const rowHeight = Math.max(
            PDF_LINE_HEIGHT + 6,
            Math.max(...cellLines.map((lines) => lines.length)) * PDF_LINE_HEIGHT + 6,
        );

        if (y - rowHeight < PDF_MARGIN) {
            addPage();
        }

        let x = PDF_MARGIN;
        const gridColor = rgb(0.72, 0.75, 0.78);
        if (header) {
            page.drawRectangle({
                x: PDF_MARGIN,
                y: y - rowHeight,
                width: usableWidth,
                height: rowHeight,
                color: rgb(0.93, 0.95, 0.97),
            });
        }

        page.drawLine({
            start: { x: PDF_MARGIN, y },
            end: { x: PDF_MARGIN + usableWidth, y },
            thickness: 0.5,
            color: gridColor,
        });

        for (let index = 0; index < values.length; index += 1) {
            page.drawLine({
                start: { x, y },
                end: { x, y: y - rowHeight },
                thickness: 0.5,
                color: gridColor,
            });

            const lines = cellLines[index];
            let textY = y - 11;
            for (const line of lines) {
                page.drawText(line, {
                    x: x + 3,
                    y: textY,
                    size: header ? PDF_HEADER_SIZE : PDF_FONT_SIZE,
                    font: header ? bold : font,
                    color: rgb(0.15, 0.18, 0.22),
                });
                textY -= PDF_LINE_HEIGHT;
            }
            x += colWidths[index];
        }

        page.drawLine({
            start: { x: PDF_MARGIN + usableWidth, y },
            end: { x: PDF_MARGIN + usableWidth, y: y - rowHeight },
            thickness: 0.5,
            color: gridColor,
        });
        page.drawLine({
            start: { x: PDF_MARGIN, y: y - rowHeight },
            end: { x: PDF_MARGIN + usableWidth, y: y - rowHeight },
            thickness: 0.5,
            color: gridColor,
        });
        y -= rowHeight;
    };

    drawTitle(page);
    rows.forEach((row, index) => {
        drawRow(row, index === 0);
    });

    const bytes = await doc.save();
    return Buffer.from(bytes);
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

export async function generateTaskReportPdf(time: timeRange): Promise<Buffer> {
    try {
        const groups = await fetchReportGroups(time);
        return generateTaskReportPdfBuffer(groups, time);
    } catch (error) {
        logger.error("generateTaskReportPdf error", error);
        await notifyAdminError("generate task report pdf");
        throw new AppError("Failed to generate task report PDF", (error as Error).message, 500);
    }
}
