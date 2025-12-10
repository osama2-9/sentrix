import xss from "xss";

/**
 * Recursively sanitizes input to prevent XSS attacks
 * @param input Any input value (string, array, object, etc.)
 * @returns Sanitized version of the input
 */
export function sanitizeInput(input: any): any {
  if (typeof input === "string") {
    return xss(input);
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (input !== null && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, sanitizeInput(v)])
    );
  }

  return input;
}
