import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { getAllowedOrigins } from "../config/env";

describe("CORS Configuration & Preflight Test Suite", () => {
  const app = createApp();

  it("should include localhost:3000 and the deployed render domain by default", () => {
    const origins = getAllowedOrigins();
    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("https://reachinbox-web-nawz.onrender.com");
  });

  it("should succeed for preflight OPTIONS requests from localhost", async () => {
    const res = await request(app)
      .options("/api/campaigns")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type, Authorization");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["access-control-allow-methods"]).toBeDefined();
  });

  it("should succeed for preflight OPTIONS requests from Render frontend", async () => {
    const res = await request(app)
      .options("/api/campaigns")
      .set("Origin", "https://reachinbox-web-nawz.onrender.com")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type, Authorization");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://reachinbox-web-nawz.onrender.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["access-control-allow-methods"]).toBeDefined();
  });

  it("should return CORS headers on unauthenticated endpoint for localhost", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", "http://localhost:3000")
      .send({});

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("should return CORS headers on unauthenticated endpoint for Render frontend", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://reachinbox-web-nawz.onrender.com")
      .send({});

    expect(res.headers["access-control-allow-origin"]).toBe("https://reachinbox-web-nawz.onrender.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("should allow server-to-server or non-browser requests with no Origin header", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    // 400 Bad Request from validation is returned without CORS rejection
    expect(res.status).toBe(400);
  });

  it("should reject requests from unauthorized origins", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://unauthorized-malicious-site.com")
      .send({});

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.body.error).toContain("Not allowed by CORS");
  });
});
