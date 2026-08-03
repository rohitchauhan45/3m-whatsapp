import { NextFunction, Response, Router } from "express";
import { AppError } from "../../libraries/error-handling/AppError";
import { authenticateToken, AuthRequest, requireAdmin } from "../../middlewares/jwt";
import { logRequest } from "../../middlewares/log";
import { createSiteSchema, geocodeQuerySchema, siteIdSchema, assignSiteUsersSchema } from "./request";
import {
    assignUsersToSite,
    createSite,
    getSiteById,
    listAssignableSiteUsers,
    listSites,
    reverseGeocodeSiteAddress,
} from "./service";

export const routes = (): Router => {
    const router = Router();

    router.get(
        "/",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (_req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const result = await listSites();
                res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.get(
        "/geocode",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const parsed = geocodeQuerySchema.safeParse(req.query);
                if (!parsed.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: parsed.error.issues.map((i) => i.message).join("; "),
                    });
                    return;
                }

                const result = await reverseGeocodeSiteAddress(
                    parsed.data.latitude,
                    parsed.data.longitude,
                );
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
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const parsed = createSiteSchema.safeParse(req.body);
                if (!parsed.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: parsed.error.issues.map((i) => i.message).join("; "),
                    });
                    return;
                }

                const adminId = req.user?.userId;
                if (!adminId) {
                    throw new AppError("Unauthorized", "Admin id missing");
                }

                const result = await createSite(parsed.data, adminId);
                res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.get(
        "/:id/assignable-users",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const parsed = siteIdSchema.safeParse({ id: req.params.id });
                if (!parsed.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: parsed.error.issues.map((i) => i.message).join("; "),
                    });
                    return;
                }

                const result = await listAssignableSiteUsers(parsed.data.id);
                res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    router.post(
        "/:id/users",
        logRequest({}),
        authenticateToken,
        requireAdmin,
        async (req: AuthRequest, res: Response, next: NextFunction) => {
            try {
                const idParsed = siteIdSchema.safeParse({ id: req.params.id });
                if (!idParsed.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: idParsed.error.issues.map((i) => i.message).join("; "),
                    });
                    return;
                }

                const bodyParsed = assignSiteUsersSchema.safeParse(req.body);
                if (!bodyParsed.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: bodyParsed.error.issues.map((i) => i.message).join("; "),
                    });
                    return;
                }

                const result = await assignUsersToSite(idParsed.data.id, bodyParsed.data);
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
                const parsed = siteIdSchema.safeParse({ id: req.params.id });
                if (!parsed.success) {
                    res.status(400).json({
                        success: false,
                        status: 400,
                        message: parsed.error.issues.map((i) => i.message).join("; "),
                    });
                    return;
                }

                const result = await getSiteById(parsed.data.id);
                res.status(result.status).json(result);
            } catch (error) {
                next(error);
            }
        },
    );

    return router;
};
