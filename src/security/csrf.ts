import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { Redis } from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { CSRFError } from "../utils/errors.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf-token";
const TOKEN_EXPIRY = 3600; // 1 hour in seconds

let redisClient: Redis | null = null;

// In-memory fallback for CSRF tokens
const memoryTokens = new Map<string, { token: string; expiresAt: number }>();

// Cleanup interval reference for proper teardown
let cleanupInterval: NodeJS.Timeout | null = null;

if (config.redis.enabled) {
  try {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1, // Fail fast in tests
      retryStrategy: () => null, // Don't retry in tests
    });
    logger.info("CSRF: Using Redis for token storage");
  } catch (err) {
    logger.warn("CSRF: Failed to connect to Redis, using in-memory storage");
    redisClient = null;
  }
} else {
  logger.info("CSRF: Using in-memory token storage");

  // Cleanup expired tokens periodically
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryTokens.entries()) {
      if (value.expiresAt < now) {
        memoryTokens.delete(key);
      }
    }
  }, 60000); // Clean up every minute

  // Allow cleanup to not block process exit
  cleanupInterval.unref();
}

// Cleanup function for tests
export function cleanupCsrf(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
  memoryTokens.clear();
}

/**
 * Generates a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Stores CSRF token with session identifier
 */
async function storeToken(sessionId: string, token: string): Promise<void> {
  if (redisClient) {
    await redisClient.setex(`csrf:${sessionId}`, TOKEN_EXPIRY, token);
  } else {
    memoryTokens.set(sessionId, {
      token,
      expiresAt: Date.now() + TOKEN_EXPIRY * 1000,
    });
  }
}

/**
 * Retrieves CSRF token for session identifier
 */
async function getToken(sessionId: string): Promise<string | null> {
  if (redisClient) {
    return await redisClient.get(`csrf:${sessionId}`);
  } else {
    const entry = memoryTokens.get(sessionId);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.token;
    }
    return null;
  }
}

/**
 * Gets or creates a session ID from cookies or generates new one
 */
function getOrCreateSessionId(req: Request, res: Response): string {
  let sessionId = req.cookies?.[CSRF_COOKIE];

  if (!sessionId) {
    sessionId = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, sessionId, {
      httpOnly: true,
      secure: config.env === "production",
      sameSite: "strict",
      maxAge: TOKEN_EXPIRY * 1000,
    });
  }

  return sessionId;
}

/**
 * Middleware to generate and attach CSRF token to response
 * Use this on GET routes where you want to issue a token
 */
export const generateCsrfMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const sessionId = getOrCreateSessionId(req, res);
    const token = generateCsrfToken();

    await storeToken(sessionId, token);

    res.setHeader("X-CSRF-Token", token);
    res.locals.csrfToken = token; // Available in templates

    logger.debug("CSRF token generated", {
      sessionId: sessionId.substring(0, 8) + "...",
    });
    next();
  }
);

/**
 * Middleware to validate CSRF token
 * Use this on state-changing routes (POST, PUT, DELETE, PATCH)
 */
export const csrfProtection = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    // Skip CSRF for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const sessionId = req.cookies?.[CSRF_COOKIE];
    if (!sessionId) {
      logger.warn("CSRF validation failed: missing session ID");
      throw new CSRFError("Missing CSRF session");
    }

    const submittedToken = req.headers[CSRF_HEADER] as string;
    if (!submittedToken || submittedToken.length !== 64) {
      logger.warn("CSRF validation failed: invalid token format", {
        hasToken: !!submittedToken,
        tokenLength: submittedToken?.length,
      });
      throw new CSRFError("Invalid CSRF token format");
    }

    const storedToken = await getToken(sessionId);
    if (!storedToken) {
      logger.warn("CSRF validation failed: token not found or expired", {
        sessionId: sessionId.substring(0, 8) + "...",
      });
      throw new CSRFError("CSRF token expired or not found");
    }

    // Constant-time comparison to prevent timing attacks
    if (
      !crypto.timingSafeEqual(
        Buffer.from(submittedToken),
        Buffer.from(storedToken)
      )
    ) {
      logger.warn("CSRF validation failed: token mismatch", {
        sessionId: sessionId.substring(0, 8) + "...",
      });
      throw new CSRFError("CSRF token mismatch");
    }

    logger.debug("CSRF validation successful", {
      sessionId: sessionId.substring(0, 8) + "...",
    });
    next();
  }
);
