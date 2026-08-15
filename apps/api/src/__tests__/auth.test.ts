import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { hashPassword, verifyPassword, createToken, verifyCustomToken } from "../lib/crypto";

describe("Auth & Crypto Test Suite", () => {
  const app = createApp();
  const secret = "test-secret-key-12345678901234567890";

  it("should hash and verify passwords correctly using scrypt", () => {
    const raw = "SuperSecret123!";
    const hashed = hashPassword(raw);

    expect(hashed).toContain(":");
    expect(verifyPassword(raw, hashed)).toBe(true);
    expect(verifyPassword("WrongPassword", hashed)).toBe(false);
  });

  it("should create and verify valid custom HMAC tokens", () => {
    const payload = { id: "user-123", email: "user@test.com", name: "Test User" };
    const token = createToken(payload, secret);

    expect(token.startsWith("custom.")).toBe(true);

    const verified = verifyCustomToken(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe("user-123");
    expect(verified?.email).toBe("user@test.com");
  });

  it("should reject tampered or invalid custom tokens", () => {
    const payload = { id: "user-123", email: "user@test.com", name: "Test User" };
    const token = createToken(payload, secret);
    const tampered = token.slice(0, -5) + "abcde";

    expect(verifyCustomToken(tampered, secret)).toBeNull();
    expect(verifyCustomToken("invalid-token", secret)).toBeNull();
    expect(verifyCustomToken("custom.invalid", secret)).toBeNull();
  });

  it("should validate input schema on /api/auth/login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "invalid-email", password: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("valid email");
  });

  it("should validate input schema on /api/auth/register", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "invalid-email", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Password must be at least 6 characters");
  });
});
