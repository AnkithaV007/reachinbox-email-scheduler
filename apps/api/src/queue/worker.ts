import { Worker, Job, DelayedError, UnrecoverableError } from "bullmq";
import { createRedis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { EmailJobData } from "./emailQueue";
import { reserveSlot, releaseSlot, nextWindowStart } from "./rateLimiter";
import { sendEmail } from "../services/mailer";

/**
 * Processing order for every job:
 *   1. read the row and bail if it is already terminal (idempotency, cheap check)
 *   2. reserve an hourly slot; if the window is full, defer into the next one
 *   3. claim the row with a conditional UPDATE (idempotency, authoritative check)
 *   4. send, then record the outcome
 */
async function process(job: Job<EmailJobData>, token?: string) {
  const { emailJobId, senderId, seqIndex, hourlyLimit } = job.data;

  const row = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: { sender: true },
  });
  if (!row) throw new UnrecoverableError(`EmailJob ${emailJobId} no longer exists`);
  if (row.status === "sent" || row.status === "cancelled") {
    return { skipped: true, reason: row.status };
  }

  // --- hourly rate limit -------------------------------------------------
  const now = Date.now();
  const { allowed } = await reserveSlot(senderId, hourlyLimit, now);
  if (!allowed) {
    const windowStart = nextWindowStart(now);
    // Re-space the deferred jobs inside the next window by their original
    // position, so a campaign that spills over resumes in roughly FIFO order
    // instead of thundering back in arbitrary order.
    const offset = (seqIndex % hourlyLimit) * env.MIN_DELAY_BETWEEN_EMAILS_MS;
    const runAt = windowStart + offset;

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: "scheduled", scheduledAt: new Date(runAt) },
    });
    await job.moveToDelayed(runAt, token);
    logger.info(
      { emailJobId, senderId, runAt: new Date(runAt).toISOString() },
      "hourly limit reached, deferred to next window"
    );
    // Tells BullMQ the job was parked, not finished and not failed.
    throw new DelayedError();
  }

  // --- claim -------------------------------------------------------------
  // Exactly one worker can flip scheduled|queued -> sending. Everyone else
  // gets rowcount 0 and returns without touching SMTP.
  const claim = await prisma.emailJob.updateMany({
    where: { id: emailJobId, status: { in: ["scheduled", "queued"] } },
    data: { status: "sending", claimedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claim.count === 0) {
    await releaseSlot(senderId, now);
    logger.warn({ emailJobId }, "job already claimed elsewhere, skipping");
    return { skipped: true, reason: "already-claimed" };
  }

  // --- send --------------------------------------------------------------
  try {
    const result = await sendEmail(row.sender, {
      to: row.recipient,
      subject: row.subject,
      body: row.body,
    });
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: "sent",
        sentAt: new Date(),
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        lastError: null,
      },
    });
    logger.info({ emailJobId, to: row.recipient, previewUrl: result.previewUrl }, "sent");
    return { sent: true, messageId: result.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isFinalAttempt = (job.attemptsMade ?? 0) + 1 >= (job.opts.attempts ?? 1);

    await releaseSlot(senderId, now);
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        // Back to queued so the retry can claim it again; only the last
        // attempt writes the terminal failed state.
        status: isFinalAttempt ? "failed" : "queued",
        lastError: message.slice(0, 2000),
      },
    });
    logger.error({ emailJobId, err: message, isFinalAttempt }, "send failed");
    throw err;
  }
}

export function startWorker() {
  const worker = new Worker<EmailJobData>(env.QUEUE_NAME, process, {
    connection: createRedis(),
    concurrency: env.WORKER_CONCURRENCY,
    // Queue-wide, Redis-backed: at most one job may *start* per MIN_DELAY window.
    // This is what enforces the minimum gap between individual sends, and it
    // holds across every worker instance, not just this process.
    limiter: { max: 1, duration: env.MIN_DELAY_BETWEEN_EMAILS_MS },
  });

  worker.on("failed", (job, err) => {
    if (err instanceof DelayedError) return;
    logger.warn({ jobId: job?.id, err: err.message }, "job failed");
  });
  worker.on("error", (err) => logger.error({ err: err.message }, "worker error"));

  logger.info(
    {
      concurrency: env.WORKER_CONCURRENCY,
      minDelayMs: env.MIN_DELAY_BETWEEN_EMAILS_MS,
      defaultHourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    },
    "worker started"
  );
  return worker;
}
