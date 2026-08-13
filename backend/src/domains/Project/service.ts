import { Prisma, ProjectTaskStatus, ProjectTaskType } from "@prisma/client";
import logger from "../../libraries/log/logger";
import { prisma } from "../../libraries/db";
import { AppError } from "../../libraries/error-handling/AppError";
import { notifyAdminError } from "../../libraries/util/notifyAdminError";
import {
    getParentProjectTaskCode,
    readProjectProgressExcelRows,
    type ProjectImportRow,
} from "../../libraries/util/Project/readProjectXl";
import type { CreateProjectMetaInput, UpdateProjectTaskInput } from "./request";

const PREVIEW_SAMPLE_ROW_LIMIT = 8;

export type ProjectListItem = {
    id: string;
    name: string;
    description: string | null;
    plannedStart: Date | null;
    plannedEnd: Date | null;
    actualStart: Date | null;
    actualEnd: Date | null;
    createdAt: Date;
    updatedAt: Date | null;
    taskCount: number;
    subtaskCount: number;
};

export type ProjectTaskNode = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    assigneeName: string | null;
    type: string;
    status: string;
    completionPct: number | null;
    totalQty: number | null;
    completedQty: number | null;
    durationDays: number | null;
    plannedStart: string | null;
    plannedEnd: string | null;
    actualStart: string | null;
    actualEnd: string | null;
    childCount: number;
    children: ProjectTaskNode[];
};

export type ProjectDetail = {
    id: string;
    name: string;
    description: string | null;
    plannedStart: string | null;
    plannedEnd: string | null;
    actualStart: string | null;
    actualEnd: string | null;
    createdAt: string;
    updatedAt: string | null;
    taskCount: number;
    subtaskCount: number;
    rootTasks: ProjectTaskNode[];
};

export type ProjectTaskBranch = {
    project: {
        id: string;
        name: string;
    };
    task: ProjectTaskNode;
    children: ProjectTaskNode[];
};

export type ProjectPreviewRow = {
    startRow: number;
    code: string;
    name: string;
    assigneeName: string;
    durationDays: number | null;
    plannedStart: string | null;
    plannedEnd: string | null;
    actualStart: string | null;
    actualEnd: string | null;
    totalQty: number | null;
    completedQty: number | null;
    completionPct: number | null;
};

type ServiceResult<T> = {
    success: boolean;
    status: number;
    message: string;
    data?: T;
    error?: string;
    failedRows?: { row: number; reason: string }[];
};

function toIsoOrNull(date: Date | null): string | null {
    return date ? date.toISOString() : null;
}

function toDecimalOrNull(value: number | null | undefined): Prisma.Decimal | null {
    if (value == null) return null;
    return new Prisma.Decimal(value);
}

function inferTaskType(code: string, codes: Set<string>): ProjectTaskType {
    for (const other of codes) {
        if (other !== code && other.startsWith(`${code}.`)) {
            return ProjectTaskType.GROUP;
        }
    }
    return ProjectTaskType.TASK;
}

function inferTaskStatus(completionPct: number | null): ProjectTaskStatus {
    if (completionPct == null) return ProjectTaskStatus.PENDING;
    if (completionPct >= 100) return ProjectTaskStatus.COMPLETED;
    if (completionPct > 0) return ProjectTaskStatus.IN_PROGRESS;
    return ProjectTaskStatus.PENDING;
}

type ProjectTaskRecord = {
    id: string;
    parentId: string | null;
    code: string | null;
    name: string;
    description: string | null;
    type: ProjectTaskType;
    status: ProjectTaskStatus;
    plannedStart: Date | null;
    plannedEnd: Date | null;
    actualStart: Date | null;
    actualEnd: Date | null;
    durationdays: number | null;
    totalQty: Prisma.Decimal | null;
    completedQty: Prisma.Decimal | null;
    completionpt: Prisma.Decimal | null;
    position: number;
};

function parseAssigneeName(description: string | null): string | null {
    if (!description?.trim()) return null;
    const match = description.match(/^Assignee:\s*(.+)$/i);
    return match?.[1]?.trim() ?? description.trim();
}

function formatTaskType(type: ProjectTaskType): string {
    if (type === ProjectTaskType.GROUP) return "Group";
    if (type === ProjectTaskType.MILESTONE) return "Milestone";
    return "Task";
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
    if (value == null) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function formatTaskStatus(status: ProjectTaskStatus): string {
    if (status === ProjectTaskStatus.IN_PROGRESS) return "In Progress";
    if (status === ProjectTaskStatus.COMPLETED) return "Completed";
    if (status === ProjectTaskStatus.ON_HOLD) return "On Hold";
    if (status === ProjectTaskStatus.CANCELLED) return "Cancelled";
    return "Pending";
}

function mapTaskRecordToNode(
    task: ProjectTaskRecord,
    childrenByParent: Map<string | null, ProjectTaskRecord[]>,
): ProjectTaskNode {
    const childRows = childrenByParent.get(task.id) ?? [];
    return {
        id: task.id,
        code: task.code ?? "",
        name: task.name,
        description: task.description,
        assigneeName: parseAssigneeName(task.description),
        type: formatTaskType(task.type),
        status: formatTaskStatus(task.status),
        completionPct: decimalToNumber(task.completionpt),
        totalQty: decimalToNumber(task.totalQty),
        completedQty: decimalToNumber(task.completedQty),
        durationDays: task.durationdays,
        plannedStart: toIsoOrNull(task.plannedStart),
        plannedEnd: toIsoOrNull(task.plannedEnd),
        actualStart: toIsoOrNull(task.actualStart),
        actualEnd: toIsoOrNull(task.actualEnd),
        childCount: childRows.length,
        children: childRows.map((child) => mapTaskRecordToNode(child, childrenByParent)),
    };
}

async function loadProjectTaskTree(projectId: string): Promise<{
    project: {
        id: string;
        name: string;
        description: string | null;
        plannedStart: Date | null;
        plannedEnd: Date | null;
        actualStart: Date | null;
        actualEnd: Date | null;
        createdAt: Date;
        updatedAt: Date | null;
    } | null;
    tasks: ProjectTaskRecord[];
    childrenByParent: Map<string | null, ProjectTaskRecord[]>;
}> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            id: true,
            name: true,
            description: true,
            plannedStart: true,
            plannedEnd: true,
            actualStart: true,
            actualEnd: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!project) {
        return { project: null, tasks: [], childrenByParent: new Map() };
    }

    const tasks = await prisma.projectTask.findMany({
        where: { projectId, deletedAt: null },
        orderBy: [{ position: "asc" }, { code: "asc" }],
        select: {
            id: true,
            parentId: true,
            code: true,
            name: true,
            description: true,
            type: true,
            status: true,
            plannedStart: true,
            plannedEnd: true,
            actualStart: true,
            actualEnd: true,
            durationdays: true,
            totalQty: true,
            completedQty: true,
            completionpt: true,
            position: true,
        },
    });

    const childrenByParent = new Map<string | null, ProjectTaskRecord[]>();
    for (const task of tasks) {
        const key = task.parentId ?? null;
        const bucket = childrenByParent.get(key);
        if (bucket) {
            bucket.push(task);
        } else {
            childrenByParent.set(key, [task]);
        }
    }

    return { project, tasks, childrenByParent };
}

function mapImportRowToPreview(row: ProjectImportRow): ProjectPreviewRow {
    return {
        startRow: row.startRow,
        code: row.code,
        name: row.name,
        assigneeName: row.assigneeName,
        durationDays: row.durationDays,
        plannedStart: toIsoOrNull(row.plannedStart),
        plannedEnd: toIsoOrNull(row.plannedEnd),
        actualStart: toIsoOrNull(row.actualStart),
        actualEnd: toIsoOrNull(row.actualEnd),
        totalQty: row.totalQty,
        completedQty: row.completedQty,
        completionPct: row.completionPct,
    };
}

function validateHierarchy(rows: ProjectImportRow[]): { row: number; reason: string }[] {
    const failedRows: { row: number; reason: string }[] = [];
    const seenCodes = new Set<string>();

    for (const row of rows) {
        if (seenCodes.has(row.code)) {
            failedRows.push({
                row: row.startRow,
                reason: `Duplicate task code "${row.code}"`,
            });
            continue;
        }
        seenCodes.add(row.code);

        const parentCode = getParentProjectTaskCode(row.code);
        if (parentCode && !seenCodes.has(parentCode)) {
            failedRows.push({
                row: row.startRow,
                reason: `Parent task "${parentCode}" must appear before "${row.code}"`,
            });
        }
    }

    return failedRows;
}

function projectDateRange(rows: ProjectImportRow[]): {
    plannedStart: Date | null;
    plannedEnd: Date | null;
    actualStart: Date | null;
    actualEnd: Date | null;
} {
    const plannedStarts = rows.map((row) => row.plannedStart).filter((date): date is Date => date != null);
    const plannedEnds = rows.map((row) => row.plannedEnd).filter((date): date is Date => date != null);
    const actualStarts = rows.map((row) => row.actualStart).filter((date): date is Date => date != null);
    const actualEnds = rows.map((row) => row.actualEnd).filter((date): date is Date => date != null);

    return {
        plannedStart: plannedStarts.length > 0 ? new Date(Math.min(...plannedStarts.map((d) => d.getTime()))) : null,
        plannedEnd: plannedEnds.length > 0 ? new Date(Math.max(...plannedEnds.map((d) => d.getTime()))) : null,
        actualStart: actualStarts.length > 0 ? new Date(Math.min(...actualStarts.map((d) => d.getTime()))) : null,
        actualEnd: actualEnds.length > 0 ? new Date(Math.max(...actualEnds.map((d) => d.getTime()))) : null,
    };
}

export function previewProjectImport(buffer: Buffer): ServiceResult<{
    sampleRows: ProjectPreviewRow[];
    taskCount: number;
}> {
    try {
        const parsedRows = readProjectProgressExcelRows(buffer);
        const failedRows = validateHierarchy(parsedRows);

        if (failedRows.length > 0) {
            return {
                success: false,
                status: 400,
                message: failedRows[0].reason,
                failedRows,
            };
        }

        const sampleRows = parsedRows
            .slice(0, PREVIEW_SAMPLE_ROW_LIMIT)
            .map(mapImportRowToPreview);

        return {
            success: true,
            status: 200,
            message: "Project file parsed successfully",
            data: {
                sampleRows,
                taskCount: parsedRows.length,
            },
        };
    } catch (error) {
        logger.error("previewProjectImport error", error);
        const message = error instanceof Error ? error.message : "Failed to read project file";
        return {
            success: false,
            status: 400,
            message,
            failedRows: [{ row: 0, reason: message }],
        };
    }
}

export async function listProjects(): Promise<ServiceResult<ProjectListItem[]>> {
    try {
        const projects = await prisma.project.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                description: true,
                plannedStart: true,
                plannedEnd: true,
                actualStart: true,
                actualEnd: true,
                createdAt: true,
                updatedAt: true,
                projectTasks: {
                    where: { deletedAt: null },
                    select: { id: true, parentId: true },
                },
            },
        });

        const data: ProjectListItem[] = projects.map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            plannedStart: project.plannedStart,
            plannedEnd: project.plannedEnd,
            actualStart: project.actualStart,
            actualEnd: project.actualEnd,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            taskCount: project.projectTasks.length,
            subtaskCount: project.projectTasks.filter((task) => task.parentId === null).length,
        }));

        return {
            success: true,
            status: 200,
            message: "Projects fetched",
            data,
        };
    } catch (error) {
        logger.error("listProjects error", error);
        await notifyAdminError("list projects");
        throw new AppError("Error listing projects", (error as Error).message);
    }
}

export async function getProjectById(projectId: string): Promise<ServiceResult<ProjectDetail>> {
    try {
        const { project, tasks, childrenByParent } = await loadProjectTaskTree(projectId);

        if (!project) {
            return {
                success: false,
                status: 404,
                message: "Project not found",
            };
        }

        const rootTasks = (childrenByParent.get(null) ?? []).map((task) =>
            mapTaskRecordToNode(task, childrenByParent),
        );

        const data: ProjectDetail = {
            id: project.id,
            name: project.name,
            description: project.description,
            plannedStart: toIsoOrNull(project.plannedStart),
            plannedEnd: toIsoOrNull(project.plannedEnd),
            actualStart: toIsoOrNull(project.actualStart),
            actualEnd: toIsoOrNull(project.actualEnd),
            createdAt: project.createdAt.toISOString(),
            updatedAt: project.updatedAt ? project.updatedAt.toISOString() : null,
            taskCount: tasks.length,
            subtaskCount: (childrenByParent.get(null) ?? []).length,
            rootTasks,
        };

        return {
            success: true,
            status: 200,
            message: "Project fetched",
            data,
        };
    } catch (error) {
        logger.error("getProjectById error", error);
        await notifyAdminError("get project by id");
        throw new AppError("Error fetching project", (error as Error).message);
    }
}

export async function getProjectTaskBranch(
    projectId: string,
    taskId: string,
): Promise<ServiceResult<ProjectTaskBranch>> {
    try {
        const { project, childrenByParent } = await loadProjectTaskTree(projectId);

        if (!project) {
            return {
                success: false,
                status: 404,
                message: "Project not found",
            };
        }

        const taskRecord = [...childrenByParent.values()]
            .flat()
            .find((task) => task.id === taskId);

        if (!taskRecord) {
            return {
                success: false,
                status: 404,
                message: "Task not found",
            };
        }

        const task = mapTaskRecordToNode(taskRecord, childrenByParent);
        const children = (childrenByParent.get(taskId) ?? []).map((child) =>
            mapTaskRecordToNode(child, childrenByParent),
        );

        return {
            success: true,
            status: 200,
            message: "Project task fetched",
            data: {
                project: {
                    id: project.id,
                    name: project.name,
                },
                task,
                children,
            },
        };
    } catch (error) {
        logger.error("getProjectTaskBranch error", error);
        await notifyAdminError("get project task branch");
        throw new AppError("Error fetching project task", (error as Error).message);
    }
}

export async function updateProjectTask(
    projectId: string,
    taskId: string,
    input: UpdateProjectTaskInput,
): Promise<ServiceResult<ProjectTaskNode>> {
    try {
        const existing = await prisma.projectTask.findFirst({
            where: {
                id: taskId,
                projectId,
                deletedAt: null,
            },
            select: { id: true },
        });

        if (!existing) {
            return {
                success: false,
                status: 404,
                message: "Task not found",
            };
        }

        const description = input.assigneeName ? `Assignee: ${input.assigneeName}` : null;

        await prisma.projectTask.update({
            where: { id: taskId },
            data: {
                name: input.name,
                description,
                type: input.type,
                status: input.status,
                durationdays: input.durationDays,
                totalQty: toDecimalOrNull(input.totalQty),
                completedQty: toDecimalOrNull(input.completedQty),
                completionpt: toDecimalOrNull(input.completionPct),
            },
        });

        const { childrenByParent } = await loadProjectTaskTree(projectId);
        const updated = await prisma.projectTask.findFirst({
            where: { id: taskId, deletedAt: null },
            select: {
                id: true,
                parentId: true,
                code: true,
                name: true,
                description: true,
                type: true,
                status: true,
                plannedStart: true,
                plannedEnd: true,
                actualStart: true,
                actualEnd: true,
                durationdays: true,
                totalQty: true,
                completedQty: true,
                completionpt: true,
                position: true,
            },
        });

        if (!updated) {
            return {
                success: false,
                status: 404,
                message: "Task not found",
            };
        }

        const task = mapTaskRecordToNode(updated, childrenByParent);

        return {
            success: true,
            status: 200,
            message: "Task updated",
            data: task,
        };
    } catch (error) {
        logger.error("updateProjectTask error", error);
        await notifyAdminError("update project task");
        throw new AppError("Error updating project task", (error as Error).message);
    }
}

function taskCodeDepth(code: string): number {
    return code.split(".").length;
}

async function persistProjectWithTasks(
    importRows: ProjectImportRow[],
    meta: CreateProjectMetaInput,
    adminId: string,
): Promise<{ projectId: string; taskCount: number }> {
    const codeSet = new Set(importRows.map((row) => row.code));
    const dates = projectDateRange(importRows);
    const rowsByDepth = new Map<number, ProjectImportRow[]>();

    for (const row of importRows) {
        const depth = taskCodeDepth(row.code);
        const bucket = rowsByDepth.get(depth);
        if (bucket) {
            bucket.push(row);
        } else {
            rowsByDepth.set(depth, [row]);
        }
    }

    const depths = [...rowsByDepth.keys()].sort((a, b) => a - b);

    return prisma.$transaction(
        async (tx) => {
            const project = await tx.project.create({
                data: {
                    name: meta.name,
                    description: meta.description?.trim() || null,
                    plannedStart: dates.plannedStart,
                    plannedEnd: dates.plannedEnd,
                    actualStart: dates.actualStart,
                    actualEnd: dates.actualEnd,
                    createdById: adminId,
                },
                select: { id: true },
            });

            const codeToId = new Map<string, string>();
            const positionByParent = new Map<string | null, number>();

            for (const depth of depths) {
                const levelRows = rowsByDepth.get(depth) ?? [];
                const levelData = levelRows.map((row) => {
                    const parentCode = getParentProjectTaskCode(row.code);
                    const parentId = parentCode ? codeToId.get(parentCode) ?? null : null;

                    if (parentCode && !parentId) {
                        throw new AppError(
                            "Validation error",
                            `Parent task "${parentCode}" is missing for row ${row.startRow}`,
                            400,
                        );
                    }

                    const positionKey = parentId ?? null;
                    const position = positionByParent.get(positionKey) ?? 0;
                    positionByParent.set(positionKey, position + 1);

                    return {
                        projectId: project.id,
                        parentId,
                        name: row.name,
                        description: row.assigneeName ? `Assignee: ${row.assigneeName}` : null,
                        code: row.code,
                        position,
                        type: inferTaskType(row.code, codeSet),
                        plannedStart: row.plannedStart,
                        plannedEnd: row.plannedEnd,
                        actualStart: row.actualStart,
                        actualEnd: row.actualEnd,
                        durationdays: row.durationDays,
                        totalQty: toDecimalOrNull(row.totalQty),
                        completedQty: toDecimalOrNull(row.completedQty),
                        completionpt: toDecimalOrNull(row.completionPct),
                        status: inferTaskStatus(row.completionPct),
                    };
                });

                const created = await tx.projectTask.createManyAndReturn({
                    data: levelData,
                    select: { id: true, code: true },
                });

                for (const task of created) {
                    if (task.code) {
                        codeToId.set(task.code, task.id);
                    }
                }
            }

            return {
                projectId: project.id,
                taskCount: importRows.length,
            };
        },
        { timeout: 60_000, maxWait: 10_000 },
    );
}

export async function createProjectFromBuffer(
    buffer: Buffer,
    meta: CreateProjectMetaInput,
    adminId: string,
): Promise<ServiceResult<{ projectId: string; taskCount: number }>> {
    try {
        const importRows = readProjectProgressExcelRows(buffer);
        const failedRows = validateHierarchy(importRows);

        if (failedRows.length > 0) {
            return {
                success: false,
                status: 400,
                message: failedRows[0].reason,
                failedRows,
            };
        }

        const result = await persistProjectWithTasks(importRows, meta, adminId);

        return {
            success: true,
            status: 201,
            message: `Project created with ${result.taskCount} task`,
            data: result,
        };
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        logger.error("createProjectFromBuffer error", error);
        await notifyAdminError("create project from buffer");
        const message = error instanceof Error ? error.message : "Failed to read project file";
        return {
            success: false,
            status: 400,
            message,
            failedRows: [{ row: 0, reason: message }],
        };
    }
}
