import { z } from "zod";

export const draftTaskImportRowSchema = z.object({
    name: z.string().trim().min(1, "name is required"),
    number: z.string().optional(),
    date: z.string().optional(),
    taskName: z.string().trim().min(1, "task name is required"),
    rawStartTime: z.string().optional(),
    rawEndTime: z.string().optional(),
});

export const createDraftTasksSchema = z.object({
    rows: z.array(draftTaskImportRowSchema).min(1, "Add at least one row"),
});

export const updateDraftTaskSchema = z.object({
    uname: z.string().trim().min(1).optional(),
    number: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
    tname: z.string().trim().min(1).optional(),
    start: z.string().nullable().optional(),
    end: z.string().nullable().optional(),
});

export const draftTaskIdSchema = z.object({
    id: z.string().trim().min(1),
});

export type DraftTaskImportRow = z.infer<typeof draftTaskImportRowSchema>;
export type CreateDraftTasksInput = z.infer<typeof createDraftTasksSchema>;
export type UpdateDraftTaskInput = z.infer<typeof updateDraftTaskSchema>;
