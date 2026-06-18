import { Router } from "express";
import { routes } from "./api";

export const webhookroutes = (router:Router)=>{
    router.use("/webhook",routes())
} 