import request from "supertest";
import express from "express";
import { z } from "zod";
import { validateRequest } from "../http/inboundFilter.js";
import { sentrixErrorHandler } from "../middleware/sentrixMiddleware.js";

describe("Request Validation", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it("should validate valid request body", async () => {
    const schema = z.object({
      body: z.object({
        name: z.string(),
        age: z.number().min(0),
      }),
    });

    app.post("/test", validateRequest(schema), (_req, res) => {
      res.json({ message: "Valid" });
    });

    app.use(sentrixErrorHandler);

    const response = await request(app)
      .post("/test")
      .send({ name: "John", age: 25 });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Valid");
  });

  it("should reject invalid request body", async () => {
    const schema = z.object({
      body: z.object({
        name: z.string(),
        age: z.number().min(0),
      }),
    });

    app.post("/test", validateRequest(schema), (_req, res) => {
      res.json({ message: "Valid" });
    });

    app.use(sentrixErrorHandler);

    const response = await request(app)
      .post("/test")
      .send({ name: "John", age: -5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Invalid request payload");
    expect(response.body.details).toBeDefined();
  });

  it("should validate query parameters", async () => {
    const schema = z.object({
      query: z.object({
        page: z.string().regex(/^\d+$/),
        limit: z.string().regex(/^\d+$/),
      }),
    });

    app.get("/test", validateRequest(schema), (_req, res) => {
      res.json({ message: "Valid" });
    });

    app.use(sentrixErrorHandler);

    const response = await request(app)
      .get("/test")
      .query({ page: "1", limit: "10" });

    expect(response.status).toBe(200);
  });

  it("should reject invalid query parameters", async () => {
    const schema = z.object({
      query: z.object({
        page: z.string().regex(/^\d+$/),
      }),
    });

    app.get("/test", validateRequest(schema), (_req, res) => {
      res.json({ message: "Valid" });
    });

    app.use(sentrixErrorHandler);

    const response = await request(app).get("/test").query({ page: "invalid" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Invalid request payload");
  });

  it("should validate route parameters", async () => {
    const schema = z.object({
      params: z.object({
        id: z.string().uuid(),
      }),
    });

    app.get("/test/:id", validateRequest(schema), (_req, res) => {
      res.json({ message: "Valid" });
    });

    app.use(sentrixErrorHandler);

    const validUuid = "123e4567-e89b-12d3-a456-426614174000";
    const response = await request(app).get(`/test/${validUuid}`);

    expect(response.status).toBe(200);
  });

  it("should provide detailed error messages", async () => {
    const schema = z.object({
      body: z.object({
        email: z.string().email(),
        age: z.number().min(18).max(100),
      }),
    });

    app.post("/test", validateRequest(schema), (_req, res) => {
      res.json({ message: "Valid" });
    });

    app.use(sentrixErrorHandler);

    const response = await request(app)
      .post("/test")
      .send({ email: "invalid-email", age: 15 });

    expect(response.status).toBe(400);
    expect(response.body.details.errors).toHaveLength(2);
    expect(response.body.details.errors[0].path).toBeDefined();
    expect(response.body.details.errors[0].message).toBeDefined();
  });
});
