import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps async middleware to catch errors and pass to Express error handler
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
