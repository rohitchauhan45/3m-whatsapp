import express, {
  Express,
  NextFunction,
  Request,
  Response,
} from "express";
import helmet from "helmet";
import cors from "cors";
import { AddressInfo } from "net";
import { Server } from "http";
import config from "./configs";
import defineRoutes from "./app";
import { errorHandler } from "./libraries/error-handling";
import logger from "./libraries/log/logger";
import { addRequestIdMiddleware } from "./middlewares/request-context";
import {
  connectWithDatabase,
  disconnectFromDatabase,
} from "./libraries/db";

let connection: Server | undefined;

const createExpressApp = (): Express => {
  const expressApp = express();
  expressApp.use(addRequestIdMiddleware);
  
  // CORS configuration - allow frontend on port 4005
  expressApp.use(
    cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
    }),
  );
  
  expressApp.use(helmet());
  expressApp.use(express.urlencoded({ extended: true }));
  
  expressApp.use(express.json());

  expressApp.use((req: Request, _res: Response, next: NextFunction) => {
    // Log an info message for each incoming request
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });

  logger.info("Express middlewares are set up");
  defineRoutes(expressApp);
  defineErrorHandlingMiddleware(expressApp);
  return expressApp;
};

async function startWebServer(): Promise<Express> {
  logger.info("Starting web server...");
  const expressApp = createExpressApp();
  const APIAddress = await openConnection(expressApp);
  logger.info(`Server is running on ${APIAddress.address}:${APIAddress.port}`);
  await connectWithDatabase();
  return expressApp;
}

async function stopWebServer(): Promise<void> {
  await disconnectFromDatabase();
  await new Promise<void>((resolve) => {
    if (connection !== undefined) {
      connection.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function openConnection(expressApp: Express): Promise<AddressInfo> {
  return new Promise((resolve) => {
    const webServerPort = config.PORT;
    logger.info(`Server is about to listen to port ${webServerPort}`);

    connection = expressApp.listen(webServerPort, () => {
      errorHandler.listenToErrorEvents(connection as Server);
      resolve(connection!.address() as AddressInfo);
    });
  });
}

function defineErrorHandlingMiddleware(expressApp: Express): void {
  expressApp.use(
    (
      error: { isTrusted?: boolean; HTTPStatus?: number; message?: string; name?: string } | undefined,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      // Note: next is required for Express error handlers
      if (error && typeof error === "object") {
        if (error.isTrusted === undefined || error.isTrusted === null) {
          error.isTrusted = true;
        }
      }

      void errorHandler.handleError(error);
      
      const statusCode = error?.HTTPStatus || 500;
      const errorMessage = error?.message || "An error occurred";
      const errorName = error?.name || "Error";
      
      res.status(statusCode).json({
        error: errorName,
        message: errorMessage,
      });
    },
  );
}

export { createExpressApp, startWebServer, stopWebServer };