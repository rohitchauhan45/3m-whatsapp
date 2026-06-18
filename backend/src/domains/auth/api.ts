import express, { NextFunction, Request, Response, Router } from "express";
import logger from "../../libraries/log/logger";
import { AppError } from "../../libraries/error-handling/AppError";
import { login, signup, getMe, sendVerificationMail, verifyEmail, forgetPassword, resetPassword, verifyOtp } from "./service";
import { loginSchema, signupSchema } from "./request";
import { validateRequest } from "../../middlewares/request-validate";
import { logRequest } from "../../middlewares/log";
import { authenticateToken, AuthRequest } from "../../middlewares/jwt";

const model = "Auth";

const routes = (): Router => {
  const router = express.Router();
  logger.info(`Setting up routes for ${model}`);

  router.post(
    "/login",
    logRequest({}),
    validateRequest({ schema: loginSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await login(req.body);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/signup",
    logRequest({}),
    validateRequest({ schema: signupSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signup(req.body);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/me",
    logRequest({}),
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError("Unauthorized", "User not authenticated", 401);
        }
        const user = await getMe(req.user.userId);
        if (!user) {
          throw new AppError("User not found", "User not found", 404);
        }
        res.status(200).json({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/verify-email", logRequest({}), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await sendVerificationMail(req.body.email);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/verify-email", logRequest({}), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await verifyEmail(req.query.token as string);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/forget-password", 
    logRequest({}),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await forgetPassword(req.body.email);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/reset-password", logRequest({}),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await resetPassword(req.body.token, req.body.password);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/verify-otp", logRequest({}),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await verifyOtp(req.body.token, req.body.otp);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
};

export { routes };

