import { Router } from "express";
import { routes } from "./api";

export const projectRoutes = (router: Router): void => {
    router.use("/project", routes());
};
