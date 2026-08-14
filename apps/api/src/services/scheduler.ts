import { prisma } from "../lib/prisma";
import { emailQueue, jobIdFor } from "./../queue/emailQueue";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export type ScheduleInput = {
  userId: string;
  senderId?: string;
  subject: string;
  body: string;
  recipients: string[];
  startAt: Date;
  delayMs?: number;
  hourlyLimit?: number;
};

const ENQUEUE_CHUNK = 500;

/**
 * Fan one compose action out over N recipients.
 *
 * Rows are written first, in a transaction, so the DB is authoritative before
 * anything reaches Redis. Then jobs are added in bulk with a per-recipient
 * delay of startAt + i * delayMs. If the resulting rate exceeds the hourly cap,
 * the worker's limiter check pushes the overflow into later windows -- the
 * schedule here is intent, not a guarantee.
 */
export async function scheduleCampaign(input: ScheduleInput) {
  const delayMs = Math.max(input.delayMs ?? env.MIN_DELAY_BETWEEN_EMAILS_MS, 0);
  const hourlyLimit = input.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER;

  const sender = input.senderId
    ? await prisma.sender.findFirst({ where: { id: input.senderId, active: true } })
    : await prisma.sender.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  if (!sender) throw new Error("No active sender configured");

  const startMs = input.startAt.getTime();

  const campaign = await prisma.$transaction(async (tx) => {
    const c = await tx.campaign.create({
      data: {
        userId: input.userId,
        senderId: sender.id,
        subject: input.subject,
        body: input.body,
        startAt: input.startAt,
        delayMs,
        hourlyLimit,
        totalCount: input.recipients.length,
      },
    });
    await tx.emailJob.createMany({
      data: input.recipients.map((recipient, i) => ({
        campaignId: c.id,
        senderId: sender.id,
        recipient,
        subject: input.subject,
        body: input.body,
        seqIndex: i,
        scheduledAt: new Date(startMs + i * delayMs),
      })),
    });
    return c;
  });

  const rows = await prisma.emailJob.findMany({
    where: { campaignId: campaign.id },
    orderBy: { seqIndex: "asc" },
    select: { id: true, seqIndex: true, scheduledAt: true },
  });

  for (let i = 0; i < rows.length; i += ENQUEUE_CHUNK) {
    const chunk = rows.slice(i, i + ENQUEUE_CHUNK).map((r) => ({
      name: "send",
      data: {
        emailJobId: r.id,
        senderId: sender.id,
        campaignId: campaign.id,
        seqIndex: r.seqIndex,
        hourlyLimit,
      },
      opts: {
        jobId: jobIdFor(r.id),
        delay: Math.max(0, r.scheduledAt.getTime() - Date.now()),
      },
    }));
    await emailQueue.addBulk(chunk);
  }

  logger.info(
    { campaignId: campaign.id, recipients: rows.length, delayMs, hourlyLimit },
    "campaign scheduled"
  );
  return { campaign, scheduled: rows.length, sender };
}

export async function cancelCampaign(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
  });
  if (!campaign) {
    const error: any = new Error("Campaign not found or access denied");
    error.status = 404;
    throw error;
  }
  const rows = await prisma.emailJob.findMany({
    where: { campaignId, campaign: { userId }, status: { in: ["scheduled", "queued"] } },
    select: { id: true },
  });
  for (const r of rows) {
    const job = await emailQueue.getJob(jobIdFor(r.id));
    if (job) await job.remove().catch(() => undefined);
  }
  await prisma.emailJob.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: "cancelled" },
  });
  return { cancelled: rows.length };
}
