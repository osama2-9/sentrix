export interface HttpConfig {
  safeDomains: string[];
  timeoutMs: number;
  retries: number;
}

export interface SecurityConfig {
  enableCSRF: boolean;
  enableJWT: boolean;
  jwtSecret: string;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    maxPayloadSize: number;
  };
  cspDirectives: string[];
}

export interface RedisConfig {
  url: string;
  enabled: boolean;
}

export type Environment = "development" | "production" | "test";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface SentriXConfig {
  env: Environment;
  logLevel: LogLevel;
  port: number;
  trustProxy: boolean;
  http: HttpConfig;
  security: SecurityConfig;
  redis: RedisConfig;
}

// Re-export config for convenience
export { config } from "../config/index.js";
export type { Config } from "../config/index.js";
