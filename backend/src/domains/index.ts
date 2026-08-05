import { Router } from "express";
import authRoutes from "./auth";
import userRoutes from "./user";
import { webhookroutes } from "./webhook";
import { whtsappRoutes } from "./whtsapp";
import { taskRoutes } from "./Task";
import { adminRoutes } from "./admin";
import { siteRoutes } from "./site";
import { draftTaskRoutes } from "./DraftTask";

export default function defineRoutes(expressRouter: Router): void {
  authRoutes(expressRouter);
  userRoutes(expressRouter);
  webhookroutes(expressRouter);
  whtsappRoutes(expressRouter);
  taskRoutes(expressRouter);
  adminRoutes(expressRouter);
  siteRoutes(expressRouter);
  draftTaskRoutes(expressRouter)
}
