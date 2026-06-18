import { Router } from "express";
import { routes } from "./api";

export const whtsappRoutes = (router: Router): void => {
    router.use("/whatsapp", routes());
};