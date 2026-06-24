import { NextFunction, Request, Response, Router } from "express";
import { getAllManagers, getAllTasksByDate, getAllCronjobs, updateAdminCronjob } from "./service";
import { dashboardRoutes } from "./Dashboard";
import { authenticateToken, requireAdmin } from "../../middlewares/jwt";

export const routes = (): Router => {
    const router = Router();

    dashboardRoutes(router);

    router.get("/managers", authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await getAllManagers();
            return res.status(result.status).json(result);
        } catch (error) {
            next(error);
        }
    });

    router.get("/tasks", authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await getAllTasksByDate();
            return res.status(result.status).json(result);
        } catch (error) {
            next(error);
        }
    });

    router.get("/cronjobs", authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await getAllCronjobs();
            return res.status(result.status).json(result);
        } catch (error) {
            next(error);
        }
    });

    router.put("/cronjobs/:id", authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { name, time } = req.body;
            const adminId = (req as any).user.userId;
            const result = await updateAdminCronjob(id, { name, time, adminId });
            return res.status(result.status!).json(result);
        } catch (error) {
            next(error);
        }
    });

    return router;
};