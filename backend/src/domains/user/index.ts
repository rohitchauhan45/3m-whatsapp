import { Router } from "express";
import { routes } from "./api";

export default function defineRoutes(expressRouter: Router): void {
  expressRouter.use("/user", routes());
}


