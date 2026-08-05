import { Response, NextFunction, Router } from "express";
import { logRequest } from "../../middlewares/log";
import { authenticateToken, AuthRequest, requireAdmin } from "../../middlewares/jwt";
import { AppError } from "../../libraries/error-handling/AppError";
import {
    createDraftTasks,
    deleteDraftTaskById,
    getDraftTaskById,
    listDraftTasks,
    updateDraftTaskById,
} from "./service";
import { createDraftTasksSchema, draftTaskIdSchema, updateDraftTaskSchema } from "./request";

export const routes = (): Router => {
    const router = Router();

    router.get(
        "/",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const userId = req.user?.userId;
                if (!userId) {
                    next(new AppError("Unauthorized", "User id missing", 401));
                    return;
                }
                const result = await listDraftTasks(userId);
                return res.status(result.status).json(result);
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
                const userId = req.user?.userId;
                if (!userId) {
                    next(new AppError("Unauthorized", "User id missing", 401));
                    return;
                }

                const parsed = draftTaskIdSchema.safeParse({ id: req.params.id });
                if (!parsed.success) {
                    next(new AppError("Validation error", "Invalid draft task id", 400));
                    return;
                }

                const result = await getDraftTaskById(parsed.data.id, userId);
                return res.status(result.status).json(result);
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
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const userId = req.user?.userId;
                if (!userId) {
                    next(new AppError("Unauthorized", "User id missing", 401));
                    return;
                }

                const parsed = createDraftTasksSchema.safeParse(req.body);
                if (!parsed.success) {
                    next(
                        new AppError(
                            "Validation error",
                            parsed.error.issues.map((issue) => issue.message).join("; "),
                            400,
                        ),
                    );
                    return;
                }

                const result = await createDraftTasks(parsed.data, userId);
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.patch(
        "/:id",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const userId = req.user?.userId;
                if (!userId) {
                    next(new AppError("Unauthorized", "User id missing", 401));
                    return;
                }

                const idParsed = draftTaskIdSchema.safeParse({ id: req.params.id });
                if (!idParsed.success) {
                    next(new AppError("Validation error", "Invalid draft task id", 400));
                    return;
                }

                const bodyParsed = updateDraftTaskSchema.safeParse(req.body?.data ?? req.body);
                if (!bodyParsed.success) {
                    next(
                        new AppError(
                            "Validation error",
                            bodyParsed.error.issues.map((issue) => issue.message).join("; "),
                            400,
                        ),
                    );
                    return;
                }

                const result = await updateDraftTaskById(idParsed.data.id, bodyParsed.data, userId);
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.delete(
        "/:id",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const userId = req.user?.userId;
                if (!userId) {
                    next(new AppError("Unauthorized", "User id missing", 401));
                    return;
                }

                const parsed = draftTaskIdSchema.safeParse({ id: req.params.id });
                if (!parsed.success) {
                    next(new AppError("Validation error", "Invalid draft task id", 400));
                    return;
                }

                const result = await deleteDraftTaskById(parsed.data.id, userId);
                return res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    return router;
};
