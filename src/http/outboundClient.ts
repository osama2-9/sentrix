import fetch, { Response } from "node-fetch";
import type { RequestInit } from "node-fetch";
import { URL } from "url";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const DEFAULT_TIMEOUT = config.http.timeoutMs;
const DEFAULT_RETRIES = config.http.retries;

export class SafeHttpClient {
  private safeDomains: Set<string>;
  private timeoutMs: number;
  private retries: number;

  constructor(options?: {
    domains?: string[];
    timeoutMs?: number;
    retries?: number;
  }) {
    this.safeDomains = new Set(options?.domains || config.http.safeDomains);
    this.timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT;
    this.retries = options?.retries || DEFAULT_RETRIES;

    logger.info("SafeHttpClient initialized", {
      domains: Array.from(this.safeDomains),
      timeout: this.timeoutMs,
      retries: this.retries,
    });
  }

  /**
   * Validates URL is in allowed domain list
   */
  private checkUrl(url: string): void {
    const parsed = new URL(url);

    if (!this.safeDomains.has(parsed.hostname)) {
      logger.warn("Blocked unsafe HTTP request", {
        hostname: parsed.hostname,
        allowedDomains: Array.from(this.safeDomains),
      });
      throw new Error(`Blocked unsafe request to: ${parsed.hostname}`);
    }
  }

  /**
   * Makes HTTP request with retry logic and timeout
   */
  private async fetchWithRetry(
    url: string,
    options?: RequestInit,
    retries: number = this.retries
  ): Promise<Response> {
    this.checkUrl(url);

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        logger.info("HTTP request successful", {
          url,
          status: response.status,
          attempt: attempt + 1,
        });

        return response;
      } catch (err: any) {
        clearTimeout(timeout);

        logger.warn("HTTP request failed", {
          url,
          attempt: attempt + 1,
          maxAttempts: retries + 1,
          error: err.message,
        });

        if (attempt === retries) {
          throw new Error(
            `HTTP request failed after ${retries + 1} attempts: ${err.message}`
          );
        }

        // Exponential backoff
        const backoffMs = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error("Unreachable code");
  }

  /**
   * Makes GET request
   */
  public get(url: string, options?: RequestInit): Promise<Response> {
    return this.fetchWithRetry(url, { ...options, method: "GET" });
  }

  /**
   * Makes POST request with JSON body
   */
  public post(
    url: string,
    body: any,
    options?: RequestInit
  ): Promise<Response> {
    return this.fetchWithRetry(url, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Makes PUT request with JSON body
   */
  public put(url: string, body: any, options?: RequestInit): Promise<Response> {
    return this.fetchWithRetry(url, {
      ...options,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Makes DELETE request
   */
  public delete(url: string, options?: RequestInit): Promise<Response> {
    return this.fetchWithRetry(url, { ...options, method: "DELETE" });
  }
}
