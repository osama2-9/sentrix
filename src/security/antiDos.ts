import type { Request, Response, NextFunction } from "express";
import { Redis } from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { extractClientIP } from "../utils/ipExtractor.js";
import { RateLimitError, PayloadTooLargeError } from "../utils/errors.js";
import { asyncHandler } from "../utils/asyncHandler.js";

interface MemoryClientInfo {
  attempts: number[];
  firstSeen: number;
}

// LRU Cache for memory-based rate limiting
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists (to re-insert at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Evict least recently used if at capacity
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const memoryClients = new LRUCache<string, MemoryClientInfo>(10000);
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

let redisClient: Redis | null = null;

if (config.redis.enabled) {
  try {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1, // Fail fast in tests
      retryStrategy: () => null, // Don't retry in tests
    });
    logger.info("AntiDoS: Redis enabled for distributed rate limiting");
  } catch (err) {
    logger.warn(
      "AntiDoS: Failed to connect to Redis, using in-memory rate limiting"
    );
    redisClient = null;
  }
} else {
  logger.info("AntiDoS: Using in-memory rate limiting with LRU cache");
}

// Cleanup function for tests
export function cleanupAntiDoS(): void {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
  memoryClients.clear();
}

export const antiDoS = (options?: {
  maxRequests?: number;
  windowMs?: number;
  maxPayloadSize?: number;
}) => {
  const maxRequests =
    options?.maxRequests || config.security.rateLimit.maxRequests;
  const windowMs = options?.windowMs || config.security.rateLimit.windowMs;
  const maxPayloadSize =
    options?.maxPayloadSize || config.security.rateLimit.maxPayloadSize;

  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const now = Date.now();
      const ip = extractClientIP(req);

      if (!ip) {
        logger.warn("Unable to determine client IP for rate limiting");
        throw new RateLimitError("Unable to determine client IP");
      }

      // Cleanup old memory entries periodically
      if (!redisClient && now - lastCleanup > CLEANUP_INTERVAL) {
        logger.debug("Cleaning up expired rate limit entries");
        lastCleanup = now;
      }

      // Check payload size
      const contentLength = req.headers["content-length"];
      if (contentLength && Number(contentLength) > maxPayloadSize) {
        logger.warn("Request blocked: payload too large", {
          ip,
          size: contentLength,
          maxSize: maxPayloadSize,
        });

        res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
        throw new PayloadTooLargeError();
      }

      try {
        if (redisClient) {
          // Redis distributed rate limiting
          const key = `dos:${ip}`;
          const multi = redisClient.multi();

          multi.incr(key);
          multi.pexpire(key, windowMs);

          const results = await multi.exec();
          const current = results?.[0]?.[1] as number;

          if (current > maxRequests) {
            logger.warn("Request blocked: rate limit exceeded (Redis)", {
              ip,
              requests: current,
              limit: maxRequests,
            });

            // Add Retry-After header
            res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
            throw new RateLimitError();
          }

          logger.debug("Rate limit check passed (Redis)", {
            ip,
            requests: current,
          });
        } else {
          // Memory-based rate limiting with LRU cache
          const client = memoryClients.get(ip) || {
            attempts: [],
            firstSeen: now,
          };

          // Filter out expired attempts
          client.attempts = client.attempts.filter(
            (timestamp) => now - timestamp < windowMs
          );
          client.attempts.push(now);

          memoryClients.set(ip, client);

          if (client.attempts.length > maxRequests) {
            logger.warn("Request blocked: rate limit exceeded (memory)", {
              ip,
              requests: client.attempts.length,
              limit: maxRequests,
            });

            res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
            throw new RateLimitError();
          }

          logger.debug("Rate limit check passed (memory)", {
            ip,
            requests: client.attempts.length,
          });
        }

        // Add rate limit headers
        res.setHeader("X-RateLimit-Limit", maxRequests.toString());
        res.setHeader(
          "X-RateLimit-Window",
          Math.ceil(windowMs / 1000).toString()
        );

        next();
      } catch (err) {
        if (
          err instanceof RateLimitError ||
          err instanceof PayloadTooLargeError
        ) {
          throw err;
        }
        logger.error("AntiDoS middleware error", err);
        throw err;
      }
    }
  );
};
