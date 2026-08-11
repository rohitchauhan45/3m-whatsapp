import multer from "multer";
import { NextFunction, Request, Response, Router } from "express";
import { AppError } from "../../libraries/error-handling/AppError";
import { authenticateToken, AuthRequest, requireAdmin } from "../../middlewares/jwt";
import { logRequest } from "../../middlewares/log";
import { createProjectMetaSchema, projectIdSchema, projectTaskParamsSchema, updateProjectTaskSchema } from "./request";
import {
    createProjectFromBuffer,
    getProjectById,
    getProjectTaskBranch,
    listProjects,
    previewProjectImport,
    updateProjectTask,
} from "./service";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024, files: 1 },
    fileFilter(_req, file, cb) {
        if (file.fieldname !== "projectReport") {
            cb(new Error('Upload key must be "projectReport"'));
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

function handleProjectUpload(
    req: Request,
    res: Response,
    next: NextFunction,
    onBuffer: (buffer: Buffer) => void,
) {
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
                    'Send exactly one .xlsx file with multipart key "projectReport".',
                    400,
                ),
            );
            return;
        }
        onBuffer(file.buffer);
        next();
    });
}

export const routes = (): Router => {
    const router = Router();

    router.get(
        "/",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (_req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const result = await listProjects();
                res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.post(
        "/preview",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        (req: Request, res: Response, next: NextFunction) => {
            handleProjectUpload(req, res, next, (buffer) => {
                (req as Request & { projectReportBuffer: Buffer }).projectReportBuffer = buffer;
            });
        },
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const buffer = (req as Request & { projectReportBuffer?: Buffer }).projectReportBuffer;
                if (!buffer) {
                    next(new AppError("Upload error", "Missing upload buffer", 400));
                    return;
                }
                const result = previewProjectImport(buffer);
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.get(
        "/:id/tasks/:taskId",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const parsed = projectTaskParamsSchema.safeParse({
                    id: req.params.id,
                    taskId: req.params.taskId,
                });
                if (!parsed.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: parsed.error.issues.map((issue) => issue.message).join("; "),
                    });
                    return;
                }

                const result = await getProjectTaskBranch(parsed.data.id, parsed.data.taskId);
                res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.patch(
        "/:id/tasks/:taskId",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const parsedParams = projectTaskParamsSchema.safeParse({
                    id: req.params.id,
                    taskId: req.params.taskId,
                });
                if (!parsedParams.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: parsedParams.error.issues.map((issue) => issue.message).join("; "),
                    });
                    return;
                }

                const parsedBody = updateProjectTaskSchema.safeParse(req.body);
                if (!parsedBody.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: parsedBody.error.issues.map((issue) => issue.message).join("; "),
                    });
                    return;
                }

                const result = await updateProjectTask(
                    parsedParams.data.id,
                    parsedParams.data.taskId,
                    parsedBody.data,
                );
                res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.get(
        "/:id",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const parsed = projectIdSchema.safeParse({ id: req.params.id });
                if (!parsed.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: parsed.error.issues.map((issue) => issue.message).join("; "),
                    });
                    return;
                }

                const result = await getProjectById(parsed.data.id);
                res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.post(
        "/",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        (req: Request, res: Response, next: NextFunction) => {
            handleProjectUpload(req, res, next, (buffer) => {
                (req as Request & { projectReportBuffer: Buffer }).projectReportBuffer = buffer;
            });
        },
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const buffer = (req as Request & { projectReportBuffer?: Buffer }).projectReportBuffer;
                if (!buffer) {
                    next(new AppError("Upload error", "Missing upload buffer", 400));
                    return;
                }

                const parsed = createProjectMetaSchema.safeParse(req.body);
                if (!parsed.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: parsed.error.issues.map((issue) => issue.message).join("; "),
                    });
                    return;
                }

                const adminId = req.user?.userId;
                if (!adminId) {
                    throw new AppError("Unauthorized", "Admin id missing");
                }

                const result = await createProjectFromBuffer(buffer, parsed.data, adminId);
                res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    return router;
};
