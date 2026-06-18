import { NextFunction, Request, Response, Router } from "express";
import logger from "../../libraries/log/logger";
import { handleWebhook, verifyWebhookQuery } from "./service";

export const routes = (): Router => {
    const router = Router();

    router.post("/", (req: Request, res: Response, next: NextFunction) => {
        try {
            res.status(200).send("EVENT_RECEIVED");

            const body = req.body as unknown;

            void handleWebhook(body).catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error("webhook handleWebhook failed:", msg);
            });
        } catch (error) {
            next(error);
        }
    });

    router.get("/", (req: Request, res: Response, next: NextFunction) => {
        try {
            const mode =
                typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : "";
            const token =
                typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : "";
            const challenge =
                typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : "";

            const result = verifyWebhookQuery(mode, token, challenge);
            if (result.success) {
                return res.status(result.status).type("text/plain").send(result.challenge);
            }
            return res.status(result.status).type("text/plain").send("Forbidden");
        } catch (error) {
            next(error);
        }
    });

    return router;
};
