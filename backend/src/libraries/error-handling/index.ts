import { Server } from "http";
import util from "util";
import logger from "../log/logger";
import { AppError } from "./AppError";

let httpServerRef: Server | undefined;

const errorHandler = {
  listenToErrorEvents: (httpServer: Server): void => {
    httpServerRef = httpServer;

    process.on("uncaughtException", (error: Error) => {
      void errorHandler.handleError(error);
    });

    process.on("unhandledRejection", (reason: unknown) => {
      void errorHandler.handleError(reason);
    });

    process.on("SIGTERM", () => {
      logger.error(
        "App received SIGTERM event, try to gracefully close the server",
      );
      void terminateHttpServerAndExit();
    });

    process.on("SIGINT", () => {
      logger.error(
        "App received SIGINT event, try to gracefully close the server",
      );
      void terminateHttpServerAndExit();
    });
  },

  handleError: async (errorToHandle: unknown): Promise<void> => {
    try {
      const appError = normalizeError(errorToHandle);
      logger.error(appError.message, appError);

      if (!appError.isTrusted) {
        await terminateHttpServerAndExit();
      }
    } catch (handlingError) {
      // No logger here since it might have failed
      process.stdout.write(
        "The error handler failed. Here are the handler failure and then the origin error that it tried to handle: ",
      );
      process.stdout.write(JSON.stringify(handlingError));
      process.stdout.write(JSON.stringify(errorToHandle));
    }
  },
};

const terminateHttpServerAndExit = async (): Promise<void> => {
  if (httpServerRef) {
    await new Promise<void>((resolve) => httpServerRef?.close(() => resolve())); // Graceful shutdown
  }
  process.exit(1);
};

// The input might not be an 'AppError' or even 'Error'; this normalizes to AppError.
const normalizeError = (errorToHandle: unknown): AppError => {
  if (errorToHandle instanceof AppError) {
    return errorToHandle;
  }
  if (errorToHandle instanceof Error) {
    const appError = new AppError(errorToHandle.name, errorToHandle.message);
    appError.stack = errorToHandle.stack;
    return appError;
  }

  const inputType = typeof errorToHandle;
  return new AppError(
    "general-error",
    `Error Handler received a non-error instance with type - ${inputType}, value - ${util.inspect(
      errorToHandle,
    )}`,
  );
};

export { errorHandler };
