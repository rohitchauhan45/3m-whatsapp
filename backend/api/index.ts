import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createExpressApp } from "../src/server";
import { connectWithDatabase } from "../src/libraries/db";

let app: any = null;
let dbConnected = false;

// Initialize the Express app and database connection (cached for serverless)
const getApp = async () => {
    if (!app) {
        app = createExpressApp();

        // Connect to database if not already connected
        if (!dbConnected) {
            try {
                await connectWithDatabase();
                dbConnected = true;
            } catch (error) {
                console.error("Database connection error:", error);
                // Continue even if DB connection fails (will retry on next request)
                dbConnected = false;
            }
        }
    }
    return app;
};

// Vercel serverless function handler
export default async function handler(
    req: VercelRequest,
    res: VercelResponse
): Promise<void> {
    try {
        const expressApp = await getApp();
        // Express app handles the request/response
        expressApp(req, res);
    } catch (error) {
        console.error("Handler error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
        }
    }
}