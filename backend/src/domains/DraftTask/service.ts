import { prisma } from "../../libraries/db";
import logger from "../../libraries/log/logger";
import { notifyAdminError } from "../../libraries/util/notifyAdminError";
import { AppError } from "../../libraries/error-handling/AppError";
import { normalizeSheetDate } from "../../libraries/util/Task/readfromxl";
import { formatCalendarDateLabel } from "../../libraries/util/Task/istDate";
import type { CreateDraftTasksInput, DraftTaskImportRow, UpdateDraftTaskInput } from "./request";

export type DraftTaskRecord = {
    id: string;
    uname: string;
    number: string | null;
    date: string | null;
    tname: string;
    start: string | null;
    end: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type ServiceResult<T = undefined> = {
    success: boolean;
    status: number;
    message: string;
    data?: T;
    error?: string;
};

function digitsOnlyPhone(raw: string): string {
    return raw.replace(/\D/g, "");
}

function parseOptionalDraftDate(raw?: string | null): Date | null {
    if (!raw?.trim()) return null;
    return normalizeSheetDate(raw.trim());
}

function toDraftTaskRecord(row: {
    id: string;
    uname: string;
    number: string | null;
    date: Date | null;
    tname: string;
    start: string | null;
    end: string | null;
    createdAt: Date;
    updatedAt: Date;
}): DraftTaskRecord {
    return {
        id: row.id,
        uname: row.uname,
        number: row.number,
        date: row.date ? formatCalendarDateLabel(row.date) : null,
        tname: row.tname,
        start: row.start,
        end: row.end,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function mapImportRowToDraftData(row: DraftTaskImportRow) {
    const numberDigits = row.number ? digitsOnlyPhone(row.number) : "";
    const date = parseOptionalDraftDate(row.date);

    return {
        uname: row.name.trim(),
        number: numberDigits || null,
        date,
        tname: row.taskName.trim(),
        start: row.rawStartTime?.trim() || null,
        end: row.rawEndTime?.trim() || null,
    };
}

export async function createDraftTasks(
    input: CreateDraftTasksInput,
    userId: string,
): Promise<ServiceResult<{ items: DraftTaskRecord[]; created: number }>> {
    try {
        const created = await prisma.$transaction(
            input.rows.map((row) =>
                prisma.draftTask.create({
                    data: {
                        ...mapImportRowToDraftData(row),
                        addedbyId: userId,
                    },
                }),
            ),
        );

        const items = created.map(toDraftTaskRecord);
        return {
            success: true,
            status: 201,
            message: `Saved ${items.length} draft task(s).`,
            data: { items, created: items.length },
        };
    } catch (error) {
        logger.error("Error while create Draft task", error);
        await notifyAdminError("create draft task");
        throw new AppError("Failed to create draft tasks", (error as Error).message, 500);
    }
}

export async function listDraftTasks(userId: string): Promise<ServiceResult<{ items: DraftTaskRecord[] }>> {
    try {
        const rows = await prisma.draftTask.findMany({
            where: { addedbyId: userId },
            orderBy: { createdAt: "desc" },
        });

        return {
            success: true,
            status: 200,
            message: `Found ${rows.length} draft task(s).`,
            data: { items: rows.map(toDraftTaskRecord) },
        };
    } catch (error) {
        logger.error("Error while list Draft tasks", error);
        await notifyAdminError("list draft tasks");
        throw new AppError("Failed to list draft tasks", (error as Error).message, 500);
    }
}

export async function getDraftTaskById(
    id: string,
    userId: string,
): Promise<ServiceResult<{ item: DraftTaskRecord }>> {
    try {
        const row = await prisma.draftTask.findFirst({
            where: { id, addedbyId: userId },
        });

        if (!row) {
            return {
                success: false,
                status: 404,
                message: "Draft task not found",
                error: "Draft task not found",
            };
        }

        return {
            success: true,
            status: 200,
            message: "Draft task found",
            data: { item: toDraftTaskRecord(row) },
        };
    } catch (error) {
        logger.error("Error while get Draft task", error);
        await notifyAdminError("get draft task");
        throw new AppError("Failed to get draft task", (error as Error).message, 500);
    }
}

export async function updateDraftTaskById(
    id: string,
    data: UpdateDraftTaskInput,
    userId: string,
): Promise<ServiceResult<{ item: DraftTaskRecord }>> {
    try {
        const existing = await prisma.draftTask.findFirst({
            where: { id, addedbyId: userId },
        });

        if (!existing) {
            return {
                success: false,
                status: 404,
                message: "Draft task not found",
                error: "Draft task not found",
            };
        }

        const number =
            data.number === undefined
                ? undefined
                : (data.number === null ? null : digitsOnlyPhone(data.number) || null);

        let date: Date | null | undefined;
        if (data.date !== undefined) {
            date = data.date === null ? null : parseOptionalDraftDate(data.date);
        }

        const updated = await prisma.draftTask.update({
            where: { id },
            data: {
                ...(data.uname !== undefined ? { uname: data.uname.trim() } : {}),
                ...(number !== undefined ? { number } : {}),
                ...(date !== undefined ? { date } : {}),
                ...(data.tname !== undefined ? { tname: data.tname.trim() } : {}),
                ...(data.start !== undefined ? { start: data.start?.trim() || null } : {}),
                ...(data.end !== undefined ? { end: data.end?.trim() || null } : {}),
            },
        });

        return {
            success: true,
            status: 200,
            message: "Draft task updated",
            data: { item: toDraftTaskRecord(updated) },
        };
    } catch (error) {
        logger.error("Error while update Draft task", error);
        await notifyAdminError("update draft task");
        throw new AppError("Failed to update draft task", (error as Error).message, 500);
    }
}

export async function deleteDraftTaskById(
    id: string,
    userId: string,
): Promise<ServiceResult> {
    try {
        const existing = await prisma.draftTask.findFirst({
            where: { id, addedbyId: userId },
        });

        if (!existing) {
            return {
                success: false,
                status: 404,
                message: "Draft task not found",
                error: "Draft task not found",
            };
        }

        await prisma.draftTask.delete({ where: { id } });

        return {
            success: true,
            status: 200,
            message: "Draft task deleted",
        };
    } catch (error) {
        logger.error("Error while delete Draft task", error);
        await notifyAdminError("delete draft task");
        throw new AppError("Failed to delete draft task", (error as Error).message, 500);
    }
}
