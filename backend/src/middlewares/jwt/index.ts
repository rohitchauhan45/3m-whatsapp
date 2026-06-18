import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../../configs";
import logger from "../../libraries/log/logger";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role?: string;
    [key: string]: unknown;
  };
}

/**
 * Middleware to verify JWT token from authentication server
 * Token should be in Authorization header as: Bearer <token>
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access denied. No token provided." });
    return;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error("JWT_SECRET is not configured");
      res.status(500).json({ error: "Server configuration error" });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: string; role?: string };
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (error) {
    logger.warn(`JWT verification failed: ${error}`);
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

/**
 * Optional authentication middleware
 * Continues without error if token is missing, but sets user if token is valid
 */
export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next();
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next();
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: string; role?: string };
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

/**
 * Middleware to require admin role
 * Must be used after authenticateToken
 */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Access denied. Authentication required." });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Access denied. Admin role required." });
    return;
  }

  next();
};

