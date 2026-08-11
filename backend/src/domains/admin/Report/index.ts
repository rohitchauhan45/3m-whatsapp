import { Router } from "express";
import { routes } from "./api";

export const reportRoutes = (router: Router): void => {
    router.use("/report", routes());
};
