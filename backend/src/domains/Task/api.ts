import multer from "multer";
import { NextFunction, Request, Response, Router } from "express";
import { AppError } from "../../libraries/error-handling/AppError";
import { assignTask, createTask, createTaskFromImportRows, editTask, previewTaskImport, sendTaskFollowUp } from "./service";
import { editTaskSchema } from "./request";
import { getDueFollowUpTaskIds } from "../../scheduler";
import { authenticateToken, AuthRequest, requireAdmin } from "../../middlewares/jwt";
import { logRequest } from "../../middlewares/log";
import { getManagerTasks } from "../admin/service";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter(_req, file, cb) {
        if (file.fieldname !== "assignTask") {
            cb(new Error('Upload key must be "assignTask"'));
            return;
        }
        const lower = file.originalname.toLowerCase();
        if (!lower.endsWith(".xlsx")) {
            cb(new Error("Only .xlsx files are allowed"));
            return;
        }
        const okMime =
            file.mimetype ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            file.mimetype === "application/octet-stream";
        if (!okMime) {
            cb(new Error("Invalid file type for .xlsx"));
            return;
        }
        cb(null, true);
    },
});

function pickExcelFile(req: Request): Express.Multer.File | undefined {
    const list = req.files as Express.Multer.File[] | undefined;
    if (Array.isArray(list) && list.length > 0) return list[0];
    if (req.file) return req.file;
    return undefined;
}

export const routes = (): Router => {
    const router = Router();

    router.get(
        "/manager/:managerId/tasks",
        logRequest({}),
        authenticateToken,
        async (req: Request, res: Response, next: NextFunction) => {

            try {
                const raw = req.params.managerId;
                const managerId = Array.isArray(raw) ? raw[0] : raw;
                if (!managerId?.trim()) {
                    next(new AppError("Validation error", "managerId is required", 400));
                    return;
                }
                const result = await getManagerTasks(managerId.trim());
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    router.post(
        "/preview-task",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        (req: Request, res: Response, next: NextFunction) => {
            upload.any()(req, res, (err: unknown) => {
                if (err) {
                    const msg = err instanceof Error ? err.message : "Upload failed";
                    next(new AppError("Upload error", msg, 400));
                    return;
                }
                const file = pickExcelFile(req);
                if (!file?.buffer?.length) {
                    next(
                        new AppError(
                            "Upload error",
                            'Send exactly one .xlsx file with multipart key "assignTask".',
                            400
                        )
                    );
                    return;
                }
                (req as Request & { assignTaskBuffer: Buffer }).assignTaskBuffer = file.buffer;
                next();
            });
        },
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const buffer = (req as Request & { assignTaskBuffer?: Buffer }).assignTaskBuffer;
                if (!buffer) {
                    next(new AppError("Upload error", "Missing upload buffer", 400));
                    return;
                }
                const result = previewTaskImport(buffer);
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    router.post(
        "/create-task",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const body = req.body as { rows?: unknown };
                if (Array.isArray(body.rows) && body.rows.length > 0) {
                    const result = await createTaskFromImportRows(body.rows as Parameters<typeof createTaskFromImportRows>[0]);
                    return res.status(result.status).json(result);
                }
                next();
            } catch (error) {
                next(error);
            }
        },
        (req: Request, res: Response, next: NextFunction) => {
            upload.any()(req, res, (err: unknown) => {
                if (err) {
                    const msg = err instanceof Error ? err.message : "Upload failed";
                    next(new AppError("Upload error", msg, 400));
                    return;
                }
                const file = pickExcelFile(req);
                if (!file?.buffer?.length) {
                    next(
                        new AppError(
                            "Upload error",
                            'Send exactly one .xlsx file with multipart key "assignTask".',
                            400
                        )
                    );
                    return;
                }
                (req as Request & { assignTaskBuffer: Buffer }).assignTaskBuffer = file.buffer;
                next();
            });
        },
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const buffer = (req as Request & { assignTaskBuffer?: Buffer }).assignTaskBuffer;
                if (!buffer) {
                    next(new AppError("Upload error", "Missing upload buffer", 400));
                    return;
                }
                const result = await createTask(buffer);
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    router.post(
        "/update/:taskId",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const raw = req.params.taskId;
                const id = (Array.isArray(raw) ? raw[0] : raw)?.trim();
                if (!id) {
                    next(new AppError("Validation Error", "Task id is Required", 400));
                    return;
                }

                const parsed = editTaskSchema.safeParse(req.body?.data ?? req.body);
                if (!parsed.success) {
                    next(
                        new AppError(
                            "Validation Error",
                            parsed.error.issues.map((i) => i.message).join("; "),
                            400,
                        ),
                    );
                    return;
                }

                const userId = req.user.userId;
                const result = await editTask(id, parsed.data, userId);

                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.post(
        "/manager/:managerId/assign-task",
        logRequest({}),
        authenticateToken,
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const raw = req.params.managerId;
                const managerId = Array.isArray(raw) ? raw[0] : raw;
                if (!managerId?.trim()) {
                    next(new AppError("Validation error", "managerId is required", 400));
                    return;
                }
                const result = await assignTask(managerId.trim());
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    router.post(
        "/manager/:managerId/follow-up",
        logRequest({}),
        authenticateToken,
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const raw = req.params.managerId;
                const managerId = Array.isArray(raw) ? raw[0] : raw;
                if (!managerId?.trim()) {
                    next(new AppError("Validation error", "managerId is required", 400));
                    return;
                }
                const taskIds = await getDueFollowUpTaskIds(managerId.trim());
                const result = await sendTaskFollowUp(taskIds);
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        }
    );

    return router;
};
