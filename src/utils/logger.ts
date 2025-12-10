import { config } from "../config/index.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: number;

  constructor(level: LogLevel = "info") {
    this.minLevel = LOG_LEVELS[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    meta?: Record<string, any>
  ): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(this.sanitizeMeta(meta))}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  private sanitizeMeta(meta: Record<string, any>): Record<string, any> {
    const sanitized = { ...meta };
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "authorization",
      "cookie",
    ];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  debug(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, meta));
    }
  }

  info(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message, meta));
    }
  }

  warn(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, meta));
    }
  }

  error(
    message: string,
    error?: Error | unknown,
    meta?: Record<string, any>
  ): void {
    if (this.shouldLog("error")) {
      const errorMeta =
        error instanceof Error
          ? { error: error.message, stack: error.stack, ...meta }
          : { error: String(error), ...meta };
      console.error(this.formatMessage("error", message, errorMeta));
    }
  }
}

export const logger = new Logger(config.logLevel);
