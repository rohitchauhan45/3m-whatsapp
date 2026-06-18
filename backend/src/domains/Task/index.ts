import { Router } from "express";
import { routes } from "./api";

export const taskRoutes = (router: Router): void => {
    router.use("/task", routes());
};