import { Router } from "express";
import { routes } from "./api";

export const siteRoutes = (router: Router): void => {
    router.use("/site", routes());
};
