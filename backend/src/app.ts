import express, { Express, Router, Request, Response } from "express";
import logger from "./libraries/log/logger";
import defineDomainRoutes from "./domains";

export default function defineRoutes(expressApp: Express): void {
  logger.info("Defining routes...");
  const router: Router = express.Router();

  defineDomainRoutes(router);

  expressApp.use("/api/v1", router);
  // health check
  expressApp.get("/health", (_req: Request, res: Response) => {
    res.status(200).send("OK");
  });
  // 404 handler
  expressApp.use((_req: Request, res: Response) => {
    res.status(404).send("Not Found");
  });
  logger.info("Routes defined");
}
