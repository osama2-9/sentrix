import type { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";

/**
 * Content Security Policy middleware
 * Configures CSP headers based on application config
 */
export function cspMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  const csp = config.security.cspDirectives.join("; ");
  res.setHeader("Content-Security-Policy", csp);
  next();
}
