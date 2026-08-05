import { Router } from "express";
import { routes } from "./api";

export const draftTaskRoutes =(router:Router):void =>{
    router.use("/draft", routes())
}