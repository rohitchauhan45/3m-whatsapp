import { NextFunction, Request, Response, Router } from "express";
import { sendWhatsAppButtons } from "./sendWhatsApp";

export const routes = (): Router => {
    const router = Router();

    router.post("/send", async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = req.body as {
                number?: string;
                message?: string;
                buttons?: unknown;
                type?: string;
            };
            const result = await sendWhatsAppButtons({
                number: body.number ?? "",
                message: body.message ?? "",
                buttons: (body.buttons ?? []) as { title: string; id: string }[],
                type: typeof body.type === "string" && body.type.trim() ? body.type : "menu",
            });
            return res.status(result.status).json(result);
        } catch (error) {
            next(error);
        }
    });

    return router;
};