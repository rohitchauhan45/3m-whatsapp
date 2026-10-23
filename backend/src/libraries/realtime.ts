import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import logger from "./log/logger";

let io: Server | null = null;

export const DASHBOARD_UPDATED_EVENT = "DASHBOARD_UPDATED";

export function initRealtime(httpServer: HttpServer): void {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL,
            credentials: true,
        },
    });

    io.on("connection", () => {
        logger.info("realtime dashboard client connected");
    });

    logger.info("realtime Socket.IO enabled");
}

const NOTIFY_COALESCE_MS = 1000;
let notifyTimer: NodeJS.Timeout | null = null;

/** Tell open admin dashboards to refetch via TanStack Query (bursts coalesced into one emit). */
export function notifyDashboardUpdate(): void {
    if (!io || notifyTimer) return;
    notifyTimer = setTimeout(() => {
        notifyTimer = null;
        io?.emit(DASHBOARD_UPDATED_EVENT);
    }, NOTIFY_COALESCE_MS);
}
