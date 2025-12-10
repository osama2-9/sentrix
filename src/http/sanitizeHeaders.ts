import type { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";

/**
 * Sanitizes request headers and adds security headers to response
 * Only removes proxy headers if not behind a trusted proxy
 */
export function sanitizeHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only remove proxy headers if we're NOT trusting the proxy
  // If we trust the proxy, Express will handle these correctly
  if (!config.trustProxy) {
    delete req.headers["x-forwarded-for"];
    delete req.headers["x-real-ip"];
  }

  // Add security response headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");

  next();
}
