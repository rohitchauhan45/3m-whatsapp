import express, { NextFunction, Request, Response, Router } from "express";
import logger from "../../libraries/log/logger";
import { AppError } from "../../libraries/error-handling/AppError";
import {
  create,
  deleteById,
  getById,
  search,
  updateById,
} from "./service";
import { createUserSchema, idSchema, updateUserSchema, querySchema } from "./request";
import { validateRequest } from "../../middlewares/request-validate";
import { logRequest } from "../../middlewares/log";
import { authenticateToken, requireAdmin, AuthRequest } from "../../middlewares/jwt";

const model = "User";

const routes = (): Router => {
  const router = express.Router();
  logger.info(`Setting up routes for ${model}`);

  router.get(
    "/",
    logRequest({}),
    authenticateToken,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = querySchema.parse(req.query);
        const result = await search(query);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/",
    logRequest({}),
    authenticateToken,
    requireAdmin,
    validateRequest({ schema: createUserSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const item = await create(req.body);
        res.status(201).json({
          id: item.id,
          username: item.username,
          email: item.email,
          role: item.role,
          role_name: item.role,
          name: item.name,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:id",
    logRequest({}),
    authenticateToken,
    requireAdmin,
    validateRequest({ schema: idSchema, isParam: true }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const item = await getById(req.params.id);
        if (!item) {
          throw new AppError(`${model} not found`, `${model} not found`, 404);
        }
        res.status(200).json({
          id: item.id,
          username: item.username,
          email: item.email,
          role: item.role,
          role_name: item.role,
          name: item.name,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/:id",
    logRequest({}),
    authenticateToken,
    requireAdmin,
    validateRequest({ schema: idSchema, isParam: true }),
    validateRequest({ schema: updateUserSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const item = await updateById(req.params.id, req.body);
        if (!item) {
          throw new AppError(`${model} not found`, `${model} not found`, 404);
        }
        res.status(200).json({
          id: item.id,
          username: item.username,
          email: item.email,
          role: item.role,
          role_name: item.role,
          name: item.name,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/:id",
    logRequest({}),
    authenticateToken,
    requireAdmin,
    validateRequest({ schema: idSchema, isParam: true }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await deleteById(req.params.id);
        res.status(204).json({ message: `${model} is deleted` });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
};

export { routes };


