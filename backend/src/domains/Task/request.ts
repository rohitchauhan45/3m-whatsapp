import { z } from "zod";

const emailFromCell = z
    .unknown()
    .transform((v) => {
        if (v === undefined || v === null) return undefined;
        const s = String(v).trim();
        if (!s) return undefined;
        const r = z.string().email().safeParse(s);
        return r.success ? r.data : undefined;
    });

export const excelAssignRowSchema = z.object({
    date: z.date({
        required_error: "date is required",
        invalid_type_error: "date must be a valid date",
    }),
    name: z.string().trim().min(1, "name is required"),
    number: z.string().trim().min(1, "number is required"),
    email: emailFromCell,
    managerName: z.string().trim().min(1, "managerName is required"),
    managerMobile: z.string().trim().min(1, "manager mobile is required"),
    tasks: z
        .array(
            z.object({
                name: z.string().trim().min(1, "task name is required"),
                rawStartTime: z.string().trim().min(1, "start is required"),
                rawEndTime: z.string().trim().min(1, "end is required"),
            })
        )
        .min(1, "add at least one value in column \"task\"")
        .max(20, "max 20 task lines per block"),
});

export type ExcelAssignRow = z.infer<typeof excelAssignRowSchema>;

export function formatExcelRowZodError(error: z.ZodError): string {
    return error.issues
        .map((iss) => {
            const path = iss.path.length > 0 ? iss.path.join(".") : "row";
            const msg = iss.message && iss.message !== "Invalid input" ? iss.message : iss.code;
            return `${path}: ${msg}`;
        })
        .join("; ");
}
