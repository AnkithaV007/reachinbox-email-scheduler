import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { scheduleCampaign, cancelCampaign } from "../services/scheduler";
import { emailQueue } from "../queue/emailQueue";
import { usageFor } from "../queue/rateLimiter";
import { env } from "../config/env";
import { createToken, hashPassword, verifyPassword } from "../lib/crypto";

export const router = Router();

router.get("/health", async (_req, res) => {
  const [dbOk, counts] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    emailQueue.getJobCounts("delayed", "waiting", "active", "completed", "failed"),
  ]);
  res.json({
    ok: dbOk,
    queue: counts,
    config: {
      concurrency: env.WORKER_CONCURRENCY,
      minDelayBetweenEmailsMs: env.MIN_DELAY_BETWEEN_EMAILS_MS,
      maxEmailsPerHourPerSender: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    },
  });
});

const credentialsLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res) => {
  const parse = credentialsLoginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Please enter a valid email and password" });
  }
  const { email, password } = parse.data;
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.password) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const isValid = verifyPassword(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = createToken(
    { id: user.id, email: user.email, name: user.name },
    env.AUTH_SECRET
  );

  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    token,
  });
});

const credentialsRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
});

router.post("/auth/register", async (req, res) => {
  const parse = credentialsRegisterSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid input. Password must be at least 6 characters." });
  }
  const { email, password, name } = parse.data;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    return res.status(409).json({ error: "An account with this email address already exists" });
  }

  const hashedPassword = hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || normalizedEmail.split("@")[0],
      password: hashedPassword,
    },
  });

  const token = createToken(
    { id: user.id, email: user.email, name: user.name },
    env.AUTH_SECRET
  );

  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name },
    token,
  });
});

router.use(requireAuth);

router.get("/me", (req, res) => res.json(req.user));

router.get("/senders", async (_req, res) => {
  const senders = await prisma.sender.findMany({
    where: { active: true },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const withUsage = await Promise.all(
    senders.map(async (s) => ({
      ...s,
      usedThisHour: await usageFor(s.id),
      hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    }))
  );
  res.json(withUsage);
});

const emailRe = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const scheduleSchema = z.object({
  subject: z.string().min(1).max(255),
  body: z.string().min(1),
  recipients: z.array(z.string().regex(emailRe, "Invalid email address")).min(1).max(50_000),
  startAt: z.coerce.date(),
  delayMs: z.coerce.number().int().min(0).optional(),
  hourlyLimit: z.coerce.number().int().positive().optional(),
  senderId: z.string().uuid().optional(),
});

router.post("/campaigns", async (req, res, next) => {
  try {
    const input = scheduleSchema.parse(req.body);
    // De-dupe within a single upload; the same address twice is almost always
    // a bad CSV rather than a deliberate double send.
    const recipients = [...new Set(input.recipients.map((r) => r.trim().toLowerCase()))];
    const result = await scheduleCampaign({
      ...input,
      recipients,
      userId: req.user!.id,
    });
    res.status(201).json({
      campaignId: result.campaign.id,
      scheduled: result.scheduled,
      duplicatesRemoved: input.recipients.length - recipients.length,
      sender: { id: result.sender.id, email: result.sender.email },
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/campaigns/:id", async (req, res, next) => {
  try {
    res.json(await cancelCampaign(req.params.id, req.user!.id));
  } catch (err: any) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

router.delete("/emails/sent", async (req, res, next) => {
  try {
    const result = await prisma.emailJob.deleteMany({
      where: {
        status: { in: ["sent", "failed"] },
        campaign: { userId: req.user!.id },
      },
    });
    res.json({ deleted: result.count });
  } catch (err) {
    next(err);
  }
});

router.delete("/emails/sent/:id", async (req, res, next) => {
  try {
    const job = await prisma.emailJob.findFirst({
      where: {
        id: req.params.id,
        status: { in: ["sent", "failed"] },
        campaign: { userId: req.user!.id },
      },
    });
    if (!job) {
      return res.status(404).json({ error: "Email history record not found or access denied" });
    }
    await prisma.emailJob.delete({ where: { id: job.id } });
    res.json({ deleted: true, id: job.id });
  } catch (err) {
    next(err);
  }
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

async function list(req: any, res: any, statuses: any[], orderBy: any) {
  const { page, pageSize, search } = listSchema.parse(req.query);
  const where = {
    status: { in: statuses },
    campaign: { userId: req.user.id },
    ...(search
      ? {
          OR: [
            { recipient: { contains: search, mode: "insensitive" as const } },
            { subject: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.emailJob.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        recipient: true,
        subject: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        attempts: true,
        lastError: true,
        previewUrl: true,
        sender: { select: { email: true } },
      },
    }),
    prisma.emailJob.count({ where }),
  ]);
  res.json({ items, total, page, pageSize });
}

router.get("/emails/scheduled", (req, res, next) =>
  list(req, res, ["scheduled", "queued", "sending"], [{ scheduledAt: "asc" }]).catch(next)
);

router.get("/emails/sent", (req, res, next) =>
  list(req, res, ["sent", "failed"], [{ sentAt: "desc" }, { updatedAt: "desc" }]).catch(next)
);

router.get("/stats", async (req, res, next) => {
  try {
    const grouped = await prisma.emailJob.groupBy({
      by: ["status"],
      where: { campaign: { userId: req.user!.id } },
      _count: true,
    });
    res.json(Object.fromEntries(grouped.map((g) => [g.status, g._count])));
  } catch (err) {
    next(err);
  }
});
