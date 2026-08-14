import crypto from "crypto";

/**
 * Hashes a plaintext password securely using Node.js scrypt with a cryptographically secure random salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored scrypt salt:hash string using constant-time comparison.
 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Mints an HMAC-SHA256 signed custom token for application credential authentication.
 */
export function createToken(
  payload: { id: string; email: string; name: string },
  secret: string
): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7-day expiration
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `custom.${header}.${body}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed custom token.
 */
export function verifyCustomToken(
  token: string,
  secret: string
): { id: string; email: string; name: string } | null {
  if (!token.startsWith("custom.")) return null;
  const parts = token.slice(7).split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  try {
    const isSigValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    if (!isSigValid) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { id: payload.id, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}
