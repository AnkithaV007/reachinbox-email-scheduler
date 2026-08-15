import "dotenv/config";
import { z } from "zod";

const bool = (d: string) =>
  z.string().default(d).transform((v) => v.toLowerCase() === "true");

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default("development"),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  ALLOWED_ORIGINS: z.string().default(""),
  FRONTEND_URL: z.string().default(""),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  QUEUE_NAME: z.string().default("email-send"),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().positive().default(200),
  JOB_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  JOB_BACKOFF_MS: z.coerce.number().int().nonnegative().default(5000),
  RECONCILE_ON_BOOT: bool("true"),

  GOOGLE_CLIENT_ID: z.string().default(""),
  AUTH_SECRET: z.string().default("local-dev-secret-key-12345678901234567890"),
  REQUIRE_AUTH: bool("true"),

  SMTP_HOST: z.string().default("smtp.ethereal.email"),
  SMTP_PORT: z.coerce.number().default(587),
});

export const env = schema.parse(process.env);

export function getAllowedOrigins(): string[] {
  const defaults = [
    "http://localhost:3000",
    "https://reachinbox-web-nawz.onrender.com",
  ];

  const envSources = [
    env.ALLOWED_ORIGINS,
    env.WEB_ORIGIN,
    env.FRONTEND_URL,
    process.env.ALLOWED_ORIGINS,
    process.env.WEB_ORIGIN,
    process.env.FRONTEND_URL,
  ];

  const parsed = envSources
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .flatMap((val) => val.split(","))
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin.length > 0);

  return Array.from(new Set([...defaults, ...parsed]));
}

/** Senders are declared as SENDER_0_*, SENDER_1_*, ... so adding one is an env change. */
export type SenderConfig = {
  email: string;
  name: string;
  user: string;
  pass: string;
  host: string;
  port: number;
};

export function readSenderConfigs(): SenderConfig[] {
  const out: SenderConfig[] = [];
  for (let i = 0; i < 20; i++) {
    const email = process.env["SENDER_" + i + "_EMAIL"];
    const user = process.env["SENDER_" + i + "_USER"];
    const pass = process.env["SENDER_" + i + "_PASS"];
    if (!email || !user || !pass) continue;
    out.push({
      email,
      name: process.env["SENDER_" + i + "_NAME"] || email,
      user,
      pass,
      host: process.env["SENDER_" + i + "_HOST"] || env.SMTP_HOST,
      port: Number(process.env["SENDER_" + i + "_PORT"] || env.SMTP_PORT),
    });
  }
  return out;
}
