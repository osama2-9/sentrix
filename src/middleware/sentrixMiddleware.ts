import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodType } from "zod";
import { sanitizeHeaders } from "../http/sanitizeHeaders.js";
import { jwtVerifier, securityHeaders } from "../security/authHardening.js";
import { cspMiddleware } from "../security/csp.js";
import { antiDoS } from "../security/antiDos.js";
import { csrfProtection } from "../security/csrf.js";
import { validateRequest } from "../http/inboundFilter.js";
import { sanitizeInput } from "../security/xss.js";
import { SentriXError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

export interface SentriXOptions {
  schema?: ZodType;
  requireAuth?: boolean;
  requireCSRF?: boolean;
  enableDoS?: boolean;
  rateLimitOptions?: {
    maxRequests?: number;
    windowMs?: number;
    maxPayloadSize?: number;
  };
}

export function sentrixMiddleware(
  options: SentriXOptions = {}
): RequestHandler[] {
  const {
    schema,
    requireAuth = false,
    requireCSRF = false,
    enableDoS = true,
    rateLimitOptions = {},
  } = options;

  const middleware: RequestHandler[] = [
    sanitizeHeaders,

    securityHeaders,

    cspMiddleware,

    ...(enableDoS
      ? [
          antiDoS({
            maxRequests:
              rateLimitOptions.maxRequests ||
              config.security.rateLimit.maxRequests,
            windowMs:
              rateLimitOptions.windowMs || config.security.rateLimit.windowMs,
            maxPayloadSize:
              rateLimitOptions.maxPayloadSize ||
              config.security.rateLimit.maxPayloadSize,
          }),
        ]
      : []),

    ...(requireAuth ? [jwtVerifier] : []),

    ...(requireCSRF ? [csrfProtection] : []),

    ...(schema ? [validateRequest(schema)] : []),

    (req: Request, _res: Response, next: NextFunction) => {
      req.body = sanitizeInput(req.body);
      req.query = sanitizeInput(req.query);
      req.params = sanitizeInput(req.params);
      next();
    },
  ];

  return middleware;
}

export function sentrixErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof SentriXError) {
    logger.warn("SentriX error", {
      name: err.name,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err instanceof Error && "details" in err
        ? { details: (err as any).details }
        : {}),
    });
    return;
  }

  logger.error("Unexpected error", err, {
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: config.env === "production" ? "Internal server error" : err.message,
  });
}

export { generateCsrfMiddleware } from "../security/csrf.js";
export { SafeHttpClient } from "../http/outboundClient.js";
