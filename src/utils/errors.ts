export class SentriXError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "SentriXError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends SentriXError {
  constructor(message: string, public details?: any) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends SentriXError {
  constructor(message: string = "Authentication failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class CSRFError extends SentriXError {
  constructor(message: string = "Invalid CSRF token") {
    super(message, 403, "CSRF_ERROR");
    this.name = "CSRFError";
  }
}

export class RateLimitError extends SentriXError {
  constructor(message: string = "Too many requests") {
    super(message, 429, "RATE_LIMIT_ERROR");
    this.name = "RateLimitError";
  }
}

export class PayloadTooLargeError extends SentriXError {
  constructor(message: string = "Payload too large") {
    super(message, 413, "PAYLOAD_TOO_LARGE");
    this.name = "PayloadTooLargeError";
  }
}
