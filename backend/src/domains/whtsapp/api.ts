import { NextFunction, Request, Response, Router } from "express";
import { sendWhatsAppButtons } from "./sendWhatsApp";

export const routes = (): Router => {
    const router = Router();

    router.post("/send", async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await sendWhatsAppButtons(req.body);
            return res.status(result.status).json(result);
        } catch (error) {
            next(error);
        }
    });

    return router;
};