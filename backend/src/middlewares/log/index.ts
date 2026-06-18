import { NextFunction, Request, RequestHandler, Response } from "express";
import logger from "../../libraries/log/logger";

type LogRequestOptions = {
  fields?: string[];
};

// Middleware to log the request.
// Logic: by default it will log req.params and req.query if they exist.
// For the req.body, if no specific fields are provided in the fields array, it will log the entire body.
const logRequest = ({ fields = [] }: LogRequestOptions): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const logData: Record<string, unknown> = {};
    if (req.params) {
      logData.params = req.params;
    }
    if (req.query) {
      logData.query = req.query;
    }
    if (req.body) {
      if (fields?.length) {
        fields.forEach((field) => {
          logData[field] = (req.body as Record<string, unknown>)[field];
        });
      } else {
        logData.body = req.body;
      }
    }
    logger.info(`${req.method} ${req.originalUrl}`, logData);

    // Store the original end method
    const originalEnd = res.end.bind(res);
    // Override the end method
    res.end = ((...args: Parameters<typeof res.end>) => {
      // Log the status code after the original end method is called
      logger.info(`${req.method} ${req.originalUrl}`, {
        statusCode: res.statusCode,
      });
      return originalEnd(...args);
    }) as typeof res.end;

    next();
  };
};

export { logRequest };
