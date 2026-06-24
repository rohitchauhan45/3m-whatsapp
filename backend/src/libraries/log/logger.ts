import { createLogger, format, Logger, transports } from "winston";
import "winston-daily-rotate-file";
import { retrieveRequestId } from "../../middlewares/request-context";

const LOG_DIR = "logs";
const isProduction = process.env.NODE_ENV === "production";
const isVercel = !!process.env.VERCEL;

const logRetention = isProduction ? "14d" : "1d";
const defaultDatePattern = isProduction
  ? "YYYY-MM-DD-HH"
  : "YYYY-MM-DD";

class LogManager {
  private static instance: LogManager;
  private logger: Logger;

  private constructor() {
    const loggerTransports: any[] = [];

    // Always log to console (Vercel captures these logs)
    loggerTransports.push(
      new transports.Console({
        format:
          process.env.NODE_ENV !== "production"
            ? format.combine(
                format.colorize(),
                format.timestamp({
                  format: "YYYY-MM-DD HH:mm:ss",
                }),
                format.printf(
                  ({ timestamp, level, message }) =>
                    `${timestamp} ${level}: ${message}`,
                ),
              )
            : format.combine(
                format.timestamp({
                  format: "YYYY-MM-DD HH:mm:ss",
                }),
                format.json(),
              ),
      }),
    );

    // Only create log files when NOT running on Vercel
    if (!isVercel) {
      loggerTransports.push(
        new transports.DailyRotateFile({
          level: "error",
          filename: `${LOG_DIR}/error-%DATE%.log`,
          datePattern: defaultDatePattern,
          zippedArchive: true,
          maxSize: "10m",
          maxFiles: logRetention,
        }),

        new transports.DailyRotateFile({
          filename: `${LOG_DIR}/combined-%DATE%.log`,
          datePattern: defaultDatePattern,
          zippedArchive: true,
          maxSize: "20m",
          maxFiles: logRetention,
        }),

        new transports.DailyRotateFile({
          level: "info",
          filename: `${LOG_DIR}/application-%DATE%.log`,
          datePattern: defaultDatePattern,
          zippedArchive: true,
          maxSize: "20m",
          maxFiles: logRetention,
        }),
      );
    }

    this.logger = createLogger({
      level: "info",
      format: format.combine(
        format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json(),
        format((info) => {
          const requestId = retrieveRequestId();

          if (requestId) {
            info.requestId = requestId;
          }

          return info;
        })(),
      ),
      transports: loggerTransports,
    });
  }

  public getLogger(): Logger {
    return this.logger;
  }

  public static getInstance(): LogManager {
    if (!this.instance) {
      this.instance = new LogManager();
    }

    return this.instance;
  }
}

const logger = LogManager.getInstance().getLogger();

export default logger;