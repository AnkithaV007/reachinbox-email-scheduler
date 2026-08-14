import { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { verifyCustomToken } from "../lib/crypto";

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string; name: string };
    }
  }
}

/**
 * Verifies either:
 * 1. Application-level custom HMAC token (from email/password credential login)
 * 2. Mock/test token (for integration test suite)
 * 3. Google ID token forwarded by the frontend NextAuth Google session.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    if (!env.REQUIRE_AUTH) {
      const dev = await prisma.user.upsert({
        where: { email: "dev@local.test" },
        create: { email: "dev@local.test", name: "Dev User", googleId: "dev-local" },
        update: {},
      });
      req.user = { id: dev.id, email: dev.email, name: dev.name };
      return next();
    }
    return res.status(401).json({ error: "Missing bearer token" });
  }

  // 1. Handle custom signed tokens from email/password credentials authentication
  if (token.startsWith("custom.")) {
    const payload = verifyCustomToken(token, env.AUTH_SECRET);
    if (!payload) {
      return res.status(401).json({ error: "Invalid or expired credentials session token" });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return res.status(401).json({ error: "User account not found" });
    }
    req.user = { id: user.id, email: user.email, name: user.name };
    return next();
  }

  // 2. Handle mock/test tokens for automated integration & isolation test suite
  if (token.startsWith("mock-token-") || token.startsWith("test-token-")) {
    const key = token.replace(/^(mock|test)-token-/, "");
    const testEmail = `${key}@test.com`;
    const user = await prisma.user.upsert({
      where: { googleId: `google-id-${key}` },
      create: {
        googleId: `google-id-${key}`,
        email: testEmail,
        name: `Test User ${key.toUpperCase()}`,
      },
      update: {},
    });
    req.user = { id: user.id, email: user.email, name: user.name };
    return next();
  }

  // 3. Verify real Google ID token signature & audience
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      return res.status(401).json({ error: "Invalid token payload" });
    }
    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        avatarUrl: payload.picture ?? null,
      },
      update: { name: payload.name ?? payload.email, avatarUrl: payload.picture ?? null },
    });
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (err) {
    if (!env.REQUIRE_AUTH) {
      const dev = await prisma.user.upsert({
        where: { email: "dev@local.test" },
        create: { email: "dev@local.test", name: "Dev User", googleId: "dev-local" },
        update: {},
      });
      req.user = { id: dev.id, email: dev.email, name: dev.name };
      return next();
    }
    res.status(401).json({ error: "Token verification failed" });
  }
}
