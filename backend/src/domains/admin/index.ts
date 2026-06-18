import { Router } from "express";
import { routes } from "./api";

export const adminRoutes = (router: Router): void => {
    router.use("/admin", routes());
};
