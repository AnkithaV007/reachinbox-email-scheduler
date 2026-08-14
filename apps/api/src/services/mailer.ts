import nodemailer, { Transporter } from "nodemailer";
import { Sender } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { readSenderConfigs, env } from "../config/env";
import { logger } from "../lib/logger";

const transporters = new Map<string, Transporter>();

function transporterFor(sender: Sender): Transporter {
  const cached = transporters.get(sender.id);
  if (cached) return cached;
  const t = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465,
    auth: { user: sender.smtpUser, pass: sender.smtpPass },
    pool: true,
    maxConnections: env.WORKER_CONCURRENCY,
  });
  transporters.set(sender.id, t);
  return t;
}

export async function sendEmail(
  sender: Sender,
  msg: { to: string; subject: string; body: string }
) {
  const info = await transporterFor(sender).sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to: msg.to,
    subject: msg.subject,
    text: msg.body,
    html: msg.body.replace(/\n/g, "<br/>"),
  });
  return {
    messageId: info.messageId as string,
    previewUrl: (nodemailer.getTestMessageUrl(info) || null) as string | null,
  };
}

/**
 * Senders come from env. If none are configured, throwaway Ethereal accounts
 * are created on first boot and their credentials are logged, so a reviewer can
 * clone the repo and run it without signing up for anything.
 */
export async function ensureSenders() {
  const configured = readSenderConfigs();

  if (configured.length === 0) {
    const existing = await prisma.sender.count();
    if (existing > 0) {
      logger.info({ existing }, "using senders already in the database");
      return;
    }
    logger.warn("no SENDER_n_* env vars found, creating 2 Ethereal test accounts");
    for (let i = 0; i < 2; i++) {
      const acct = await nodemailer.createTestAccount();
      const sender = await prisma.sender.upsert({
        where: { email: acct.user },
        create: {
          email: acct.user,
          name: `Outreach ${i + 1}`,
          smtpHost: acct.smtp.host,
          smtpPort: acct.smtp.port,
          smtpUser: acct.user,
          smtpPass: acct.pass,
        },
        update: {
          name: `Outreach ${i + 1}`,
          smtpHost: acct.smtp.host,
          smtpPort: acct.smtp.port,
          smtpUser: acct.user,
          smtpPass: acct.pass,
        },
      });
      logger.info(
        { id: sender.id, user: acct.user, pass: acct.pass, web: "https://ethereal.email" },
        "created Ethereal sender -- save these credentials to .env to reuse them"
      );
    }
    return;
  }

  for (const c of configured) {
    await prisma.sender.upsert({
      where: { email: c.email },
      create: {
        email: c.email,
        name: c.name,
        smtpHost: c.host,
        smtpPort: c.port,
        smtpUser: c.user,
        smtpPass: c.pass,
      },
      update: { name: c.name, smtpHost: c.host, smtpPort: c.port, smtpUser: c.user, smtpPass: c.pass },
    });
  }
  logger.info({ count: configured.length }, "senders synced from env");
}
