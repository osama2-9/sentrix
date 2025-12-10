/**
 * SentriX - Security Middleware Library for Express
 * Main entry point for the library
 */

// Core middleware
export {
  sentrixMiddleware,
  sentrixErrorHandler,
  generateCsrfMiddleware,
  type SentriXOptions,
} from "./middleware/index.js";

// HTTP Client (separate export to avoid test issues)
export { SafeHttpClient } from "./http/outboundClient.js";

// Configuration
export { config } from "./config/index.js";
export type {
  Config,
  HttpConfig,
  SecurityConfig,
  RedisConfig,
} from "./types/index.js";

// Error classes
export {
  SentriXError,
  ValidationError,
  AuthenticationError,
  CSRFError,
  RateLimitError,
  PayloadTooLargeError,
} from "./utils/errors.js";

// Utilities
export { logger } from "./utils/logger.js";
export { extractClientIP } from "./utils/ipExtractor.js";
