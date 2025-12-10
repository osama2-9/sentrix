import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import {
  generateCsrfMiddleware,
  csrfProtection,
  cleanupCsrf,
} from "../security/csrf.js";
import { sentrixErrorHandler } from "../middleware/sentrixMiddleware.js";

describe("CSRF Protection", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Route to get CSRF token
    app.get("/token", generateCsrfMiddleware, (_req, res) => {
      res.json({ token: res.locals.csrfToken });
    });

    // Protected route
    app.post("/protected", csrfProtection, (_req, res) => {
      res.json({ message: "Success" });
    });

    // Add error handler
    app.use(sentrixErrorHandler);
  });

  afterAll(async () => {
    cleanupCsrf();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it("should generate CSRF token", async () => {
    const response = await request(app).get("/token");

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.token).toHaveLength(64);
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("should reject request without CSRF token", async () => {
    const response = await request(app)
      .post("/protected")
      .send({ data: "test" });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("CSRF");
  });

  it("should reject request with invalid CSRF token", async () => {
    const tokenResponse = await request(app).get("/token");
    const cookies = tokenResponse.headers["set-cookie"];

    const response = await request(app)
      .post("/protected")
      .set("Cookie", cookies)
      .set(
        "x-csrf-token",
        "invalid-token-that-is-64-characters-long-aaaaaaaaaaaaaaaaaaaa"
      )
      .send({ data: "test" });

    expect(response.status).toBe(403);
  });

  it("should accept request with valid CSRF token", async () => {
    // Get token
    const tokenResponse = await request(app).get("/token");
    const token = tokenResponse.body.token;
    const cookies = tokenResponse.headers["set-cookie"];

    if (!token) {
      throw new Error("Token not generated");
    }

    // Use token
    const response = await request(app)
      .post("/protected")
      .set("Cookie", cookies)
      .set("x-csrf-token", token)
      .send({ data: "test" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Success");
  });

  it("should allow GET requests without CSRF token", async () => {
    app.get("/safe", csrfProtection, (_req, res) => {
      res.json({ message: "Success" });
    });

    const response = await request(app).get("/safe");

    expect(response.status).toBe(200);
  });
});
