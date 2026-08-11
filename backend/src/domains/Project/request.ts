import { z } from "zod";
import { ProjectTaskStatus, ProjectTaskType } from "@prisma/client";
import { isCuid } from "../../libraries/util/id";

export const createProjectMetaSchema = z.object({
    name: z.string().trim().min(1, "Project name is required").max(200, "Project name is too long"),
    description: z
        .string()
        .trim()
        .max(500, "Description is too long")
        .optional()
        .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export const projectIdSchema = z.object({
    id: z.string().refine((value) => isCuid(value), {
        message: "Invalid project id",
    }),
});

export const projectTaskParamsSchema = z.object({
    id: z.string().refine((value) => isCuid(value), {
        message: "Invalid project id",
    }),
    taskId: z.string().refine((value) => isCuid(value), {
        message: "Invalid task id",
    }),
});

const optionalNumber = z.preprocess(
    (value) => {
        if (value === "" || value === null || value === undefined) return null;
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) return null;
            const parsed = Number(trimmed);
            return Number.isFinite(parsed) ? parsed : value;
        }
        return value;
    },
    z.number().nullable(),
);

const optionalInt = z.preprocess(
    (value) => {
        if (value === "" || value === null || value === undefined) return null;
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) return null;
            const parsed = Number.parseInt(trimmed, 10);
            return Number.isFinite(parsed) ? parsed : value;
        }
        return value;
    },
    z.number().int().nullable(),
);

export const updateProjectTaskSchema = z.object({
    name: z.string().trim().min(1, "Task name is required").max(500, "Task name is too long"),
    assigneeName: z
        .string()
        .trim()
        .max(200, "Assignee name is too long")
        .optional()
        .transform((value) => (value && value.length > 0 ? value : null)),
    type: z.nativeEnum(ProjectTaskType),
    status: z.nativeEnum(ProjectTaskStatus),
    durationDays: optionalInt,
    totalQty: optionalNumber,
    completedQty: optionalNumber,
    completionPct: z.preprocess(
        (value) => {
            if (value === "" || value === null || value === undefined) return null;
            if (typeof value === "string") {
                const trimmed = value.trim();
                if (!trimmed) return null;
                const parsed = Number(trimmed);
                return Number.isFinite(parsed) ? parsed : value;
            }
            return value;
        },
        z.number().min(0).max(100).nullable(),
    ),
});

export type UpdateProjectTaskInput = z.infer<typeof updateProjectTaskSchema>;

export type CreateProjectMetaInput = z.infer<typeof createProjectMetaSchema>;