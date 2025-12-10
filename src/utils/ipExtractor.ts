import type { Request } from "express";
import { config } from "../config/index.js";

/**
 * Extracts client IP address, handling proxy scenarios
 * @param req Express Request object
 * @returns Client IP address or null if unable to determine
 */
export function extractClientIP(req: Request): string | null {
  // If behind a trusted proxy, check forwarded headers
  if (config.trustProxy) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const ips =
        typeof forwarded === "string"
          ? forwarded.split(",").map((ip) => ip.trim())
          : forwarded;

      // Return the first (original client) IP
      if (ips.length > 0 && ips[0]) {
        return ips[0];
      }
    }

    // Try X-Real-IP as fallback
    const realIP = req.headers["x-real-ip"];
    if (realIP && typeof realIP === "string") {
      return realIP;
    }
  }

  // Fallback to req.ip (works with Express trust proxy setting)
  return req.ip || req.socket?.remoteAddress || null;
}

/**
 * Validates if an IP address is valid IPv4 or IPv6
 */
export function isValidIP(ip: string): boolean {
  // Simple IPv4 check
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // Simple IPv6 check
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}
