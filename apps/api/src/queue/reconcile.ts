import { prisma } from "../lib/prisma";
import { emailQueue, jobIdFor } from "./emailQueue";
import { logger } from "../lib/logger";

/**
 * Restart safety net.
 *
 * Redis with AOF already keeps delayed jobs across a process restart, so the
 * common case needs nothing. This covers the harder case: Redis itself was
 * flushed or replaced. The DB is the source of truth, so on boot we walk every
 * non-terminal row and re-add any job Redis has lost.
 *
 * Re-adding is safe because jobId is derived from the row id: rows that still
 * have their job are no-ops, and nothing can be enqueued twice.
 */
export async function reconcilePendingJobs() {
  const pending = await prisma.emailJob.findMany({
    where: { status: { in: ["scheduled", "queued", "sending"] } },
    orderBy: [{ scheduledAt: "asc" }, { seqIndex: "asc" }],
    include: { campaign: { select: { hourlyLimit: true } } },
  });

  let restored = 0;
  let alreadyQueued = 0;

  for (const row of pending) {
    const jobId = jobIdFor(row.id);
    const existing = await emailQueue.getJob(jobId);
    if (existing) {
      alreadyQueued++;
      continue;
    }
    // A row stuck in `sending` means a worker died mid-flight. It has not been
    // confirmed sent, so it is re-queued; the claim guard keeps it single-shot.
    if (row.status === "sending") {
      await prisma.emailJob.update({
        where: { id: row.id },
        data: { status: "queued", claimedAt: null },
      });
    }
    // Past-due jobs go out immediately rather than being skipped.
    const delay = Math.max(0, row.scheduledAt.getTime() - Date.now());
    await emailQueue.add(
      "send",
      {
        emailJobId: row.id,
        senderId: row.senderId,
        campaignId: row.campaignId,
        seqIndex: row.seqIndex,
        hourlyLimit: row.campaign.hourlyLimit,
      },
      { jobId, delay }
    );
    restored++;
  }

  logger.info(
    { pending: pending.length, restored, alreadyQueued },
    "reconciliation complete"
  );
  return { pending: pending.length, restored, alreadyQueued };
}
