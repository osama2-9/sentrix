import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { AuthenticationError } from "../utils/errors.js";
import { asyncHandler } from "../utils/asyncHandler.js";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * JWT verification middleware
 * Validates JWT token from Authorization header
 */
export const jwtVerifier = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      logger.warn("JWT verification failed: missing Authorization header");
      throw new AuthenticationError("Missing authentication token");
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      logger.warn("JWT verification failed: invalid Authorization format");
      throw new AuthenticationError("Invalid authentication format");
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, config.security.jwtSecret) as any;
      req.user = decoded;

      logger.debug("JWT verification successful", {
        userId: decoded.sub || decoded.id,
      });
      next();
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        logger.warn("JWT verification failed: token expired");
        throw new AuthenticationError("Token expired");
      } else if (err.name === "JsonWebTokenError") {
        logger.warn("JWT verification failed: invalid token", {
          error: err.message,
        });
        throw new AuthenticationError("Invalid token");
      } else {
        logger.error("JWT verification error", err);
        throw new AuthenticationError("Authentication failed");
      }
    }
  }
);

/**
 * Security headers middleware
 * Adds various security headers to responses
 */
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");

  next();
}
