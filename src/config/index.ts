import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.coerce.number().default(3000),
  SAFE_DOMAINS: z.string().default("api.example.com"),
  REDIS_URL: z.string().optional(),
  TRUST_PROXY: z.coerce.boolean().default(false),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(" Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

// Enforce JWT_SECRET in production
if (env.NODE_ENV === "production" && env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters in production");
  process.exit(1);
}

export const config = {
  env: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  port: env.PORT,
  trustProxy: env.TRUST_PROXY,

  http: {
    safeDomains: env.SAFE_DOMAINS.split(",").map((d) => d.trim()),
    timeoutMs: 5000,
    retries: 2,
  },

  security: {
    enableCSRF: true,
    enableJWT: true,
    jwtSecret: env.JWT_SECRET,
    rateLimit: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 100,
      maxPayloadSize: 1024 * 1024, // 1MB
    },
    cspDirectives: [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ],
  },

  redis: {
    enabled: !!env.REDIS_URL,
    url: env.REDIS_URL || "redis://localhost:6379",
  },
} as const;

export type Config = typeof config;
