import type { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";

/**
 * Express middleware factory for Zod schema validation
 * Validates req.body, req.query, and req.params against provided schema
 *
 * @param schema Zod schema to validate against
 * @returns Express middleware function
 */
export const validateRequest = <T>(schema: ZodType<T>) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        logger.warn("Request validation failed", {
          path: req.path,
          method: req.method,
          errors: err.issues.length,
        });

        throw new ValidationError("Invalid request payload", {
          errors: err.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
            code: issue.code,
          })),
        });
      }

      // Re-throw unexpected errors
      throw err;
    }
  });
