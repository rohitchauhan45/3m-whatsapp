import { NextFunction, Request, RequestHandler, Response } from "express";
import { z, ZodSchema } from "zod";
import logger from "../../libraries/log/logger";

type ValidateRequestOptions = {
  schema: ZodSchema;
  isParam?: boolean;
};

function validateRequest({
  schema,
  isParam = false,
}: ValidateRequestOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const input = isParam ? req.params : req.body;
    const validationResult = schema.safeParse(input);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(
        (error) => `${error.path.join(".")}: ${error.message}`,
      );
      logger.error(`${req.method} ${req.originalUrl} Validation failed`, {
        errors,
      });
      // Handle validation error
      return res.status(400).json({
        errors,
      });
    }

    // Validation successful - proceed
    return next();
  };
}

export { validateRequest };
