import request from "supertest";
import express from "express";
import { antiDoS, cleanupAntiDoS } from "../security/antiDos.js";
import { sentrixErrorHandler } from "../middleware/sentrixMiddleware.js";

describe("Rate Limiting", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(async () => {
    // Clean up after each test to reset rate limit state
    cleanupAntiDoS();
  });

  afterAll(async () => {
    cleanupAntiDoS();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it("should allow requests within rate limit", async () => {
    app.use(
      antiDoS({
        maxRequests: 5,
        windowMs: 60000,
      })
    );

    app.get("/test", (_req, res) => {
      res.json({ message: "Success" });
    });

    app.use(sentrixErrorHandler);

    // Make 5 requests (should all succeed)
    for (let i = 0; i < 5; i++) {
      const response = await request(app).get("/test");
      expect(response.status).toBe(200);
    }
  });

  it("should block requests exceeding rate limit", async () => {
    app.use(
      antiDoS({
        maxRequests: 3,
        windowMs: 60000,
      })
    );

    app.get("/test", (_req, res) => {
      res.json({ message: "Success" });
    });

    app.use(sentrixErrorHandler);

    // Make 3 successful requests
    for (let i = 0; i < 3; i++) {
      const response = await request(app).get("/test");
      expect(response.status).toBe(200);
    }

    // 4th request should be blocked
    const response = await request(app).get("/test");
    expect(response.status).toBe(429);
    expect(response.body.error).toContain("Too many requests");
    expect(response.headers["retry-after"]).toBeDefined();
  });

  it("should reject oversized payloads", async () => {
    app.use(
      antiDoS({
        maxRequests: 100,
        windowMs: 60000,
        maxPayloadSize: 100, // 100 bytes
      })
    );

    app.post("/test", (_req, res) => {
      res.json({ message: "Success" });
    });

    app.use(sentrixErrorHandler);

    const largePayload = "x".repeat(200);
    const response = await request(app)
      .post("/test")
      .set("Content-Type", "application/json")
      .send({ data: largePayload });

    expect(response.status).toBe(413);
    expect(response.body.error).toContain("Payload too large");
  });

  it("should add rate limit headers", async () => {
    app.use(
      antiDoS({
        maxRequests: 10,
        windowMs: 60000,
      })
    );

    app.get("/test", (_req, res) => {
      res.json({ message: "Success" });
    });

    app.use(sentrixErrorHandler);

    const response = await request(app).get("/test");

    expect(response.headers["x-ratelimit-limit"]).toBe("10");
    expect(response.headers["x-ratelimit-window"]).toBeDefined();
  });
});
