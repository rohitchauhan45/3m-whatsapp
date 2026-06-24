import { Router } from "express";
import { routes } from "./api";

export const dashboardRoutes = (router: Router): void => {
    router.use("/dashboard", routes());
};

export type { timeRange } from "./service";
