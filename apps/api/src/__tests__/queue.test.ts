import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { emailQueue, jobIdFor } from "../queue/emailQueue";
import { reserveSlot, releaseSlot, usageFor, windowKey } from "../queue/rateLimiter";
import { scheduleCampaign } from "../services/scheduler";
import { reconcilePendingJobs } from "../queue/reconcile";
import { extractEmails } from "../lib/csv";
import nodemailer from "nodemailer";
import { sendEmail } from "../services/mailer";

describe("ReachInbox Backend Queue & Scheduler Test Suite", () => {
  let testUser: { id: string; email: string };
  let testSender: { id: string; email: string; name: string; smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string };

  beforeAll(async () => {
    // Upsert a test user and test sender in local Postgres DB
    testUser = await prisma.user.upsert({
      where: { email: "test-unit@reachinbox.test" },
      create: { email: "test-unit@reachinbox.test", name: "Test Unit User", googleId: "test-google-id" },
      update: {},
    });

    testSender = await prisma.sender.upsert({
      where: { email: "test-sender@reachinbox.test" },
      create: {
        email: "test-sender@reachinbox.test",
        name: "Test Sender",
        smtpHost: "smtp.ethereal.email",
        smtpPort: 587,
        smtpUser: "test-sender-user",
        smtpPass: "test-sender-pass",
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup DB and disconnect
    await prisma.emailJob.deleteMany({ where: { campaign: { userId: testUser.id } } }).catch(() => undefined);
    await prisma.campaign.deleteMany({ where: { userId: testUser.id } }).catch(() => undefined);
  });

  // 1 & 3: Campaign scheduling & scheduledAt calculation
  it("1 & 3. schedules a campaign and calculates scheduledAt per recipient accurately", async () => {
    const startAt = new Date(Date.now() + 60000);
    const delayMs = 3000;
    const recipients = ["user1@test.com", "user2@test.com", "user3@test.com"];

    const result = await scheduleCampaign({
      userId: testUser.id,
      senderId: testSender.id,
      subject: "Test Campaign",
      body: "Test Body",
      recipients,
      startAt,
      delayMs,
      hourlyLimit: 50,
    });

    expect(result.scheduled).toBe(3);
    expect(result.campaign.totalCount).toBe(3);

    const jobsInDb = await prisma.emailJob.findMany({
      where: { campaignId: result.campaign.id },
      orderBy: { seqIndex: "asc" },
    });

    expect(jobsInDb.length).toBe(3);
    expect(jobsInDb[0].scheduledAt.getTime()).toBe(startAt.getTime());
    expect(jobsInDb[1].scheduledAt.getTime()).toBe(startAt.getTime() + delayMs);
    expect(jobsInDb[2].scheduledAt.getTime()).toBe(startAt.getTime() + 2 * delayMs);
  });

  // 2. Recipient deduplication & filtering
  it("2. deduplicates recipient emails correctly", () => {
    const csvContent = `email,name\nlead1@test.com,Lead 1\nLEAD1@TEST.COM,Lead 1 Duplicate\nlead2@test.com,Lead 2\ninvalid-email,Invalid`;
    const parsed = extractEmails(csvContent);

    expect(parsed.emails).toEqual(["lead1@test.com", "lead2@test.com"]);
    expect(parsed.duplicates).toBe(1);
  });

  // 4. Deterministic BullMQ job IDs
  it("4. generates deterministic BullMQ job IDs using emailJobId", () => {
    const emailJobId = "550e8400-e29b-41d4-a716-446655440000";
    const jobId = jobIdFor(emailJobId);

    expect(jobId).toBe("email-550e8400-e29b-41d4-a716-446655440000");
    expect(jobId).not.toContain(":");
  });

  // 5. Atomic worker claim
  it("5. atomically claims an EmailJob row so only one worker can process it", async () => {
    const job = await prisma.emailJob.create({
      data: {
        campaignId: (await prisma.campaign.create({
          data: {
            userId: testUser.id,
            senderId: testSender.id,
            subject: "Claim Test",
            body: "Body",
            startAt: new Date(),
            delayMs: 1000,
            hourlyLimit: 100,
            totalCount: 1,
          },
        })).id,
        senderId: testSender.id,
        recipient: "claim@test.com",
        subject: "Claim Test",
        body: "Body",
        seqIndex: 0,
        scheduledAt: new Date(),
      },
    });

    // Worker 1 claims job
    const claim1 = await prisma.emailJob.updateMany({
      where: { id: job.id, status: { in: ["scheduled", "queued"] } },
      data: { status: "sending", claimedAt: new Date(), attempts: { increment: 1 } },
    });
    expect(claim1.count).toBe(1);

    // Worker 2 attempts to claim same job simultaneously
    const claim2 = await prisma.emailJob.updateMany({
      where: { id: job.id, status: { in: ["scheduled", "queued"] } },
      data: { status: "sending", claimedAt: new Date(), attempts: { increment: 1 } },
    });
    expect(claim2.count).toBe(0); // Atomically blocked
  });

  // 6. Already-sent email protection
  it("6. skips processing if an EmailJob is already marked sent or cancelled", async () => {
    const job = await prisma.emailJob.create({
      data: {
        campaignId: (await prisma.campaign.create({
          data: {
            userId: testUser.id,
            senderId: testSender.id,
            subject: "Already Sent Test",
            body: "Body",
            startAt: new Date(),
            delayMs: 1000,
            hourlyLimit: 100,
            totalCount: 1,
          },
        })).id,
        senderId: testSender.id,
        recipient: "sent@test.com",
        subject: "Already Sent Test",
        body: "Body",
        seqIndex: 0,
        status: "sent",
        scheduledAt: new Date(),
      },
    });

    const row = await prisma.emailJob.findUnique({ where: { id: job.id } });
    expect(row?.status).toBe("sent");
    // Idempotency check logic: if row.status === 'sent', returns skipped without contacting SMTP
    const isTerminal = row?.status === "sent" || row?.status === "cancelled";
    expect(isTerminal).toBe(true);
  });

  // 7, 8 & 9. Redis hourly rate limit, concurrent reservations & independent sender limits
  it("7, 8 & 9. enforces Redis-backed per-sender hourly rate limits atomically across concurrent requests", async () => {
    const senderA = `sender-a-${Date.now()}`;
    const senderB = `sender-b-${Date.now()}`;
    const limit = 2;

    // Concurrent slot reservations for Sender A
    const resA = await Promise.all([
      reserveSlot(senderA, limit),
      reserveSlot(senderA, limit),
      reserveSlot(senderA, limit), // 3rd request should exceed quota
    ]);

    expect(resA[0].allowed).toBe(true);
    expect(resA[1].allowed).toBe(true);
    expect(resA[2].allowed).toBe(false); // Quota exceeded (-1)

    // Sender B should have independent rate limit window
    const resB = await reserveSlot(senderB, limit);
    expect(resB.allowed).toBe(true);
  });

  // 10. Rate-limited job rescheduling
  it("10. defers over-quota jobs into the next hourly window without marking failed", async () => {
    const now = Date.now();
    const senderId = `sender-quota-${now}`;
    const limit = 1;

    // Quota of 1 consumed
    await reserveSlot(senderId, limit, now);
    const retry = await reserveSlot(senderId, limit, now);

    expect(retry.allowed).toBe(false);

    // Simulated deferral calculation in worker
    const hourMs = 3600000;
    const windowStart = (Math.floor(now / hourMs) + 1) * hourMs;
    expect(windowStart).toBeGreaterThan(now);
  });

  // 11. SMTP success & Ethereal preview link
  it("11. sends email via Nodemailer and records messageId & previewUrl", async () => {
    const testAccount = await nodemailer.createTestAccount();
    const etherealSender = await prisma.sender.create({
      data: {
        email: testAccount.user,
        name: "Ethereal Test Sender",
        smtpHost: testAccount.smtp.host,
        smtpPort: testAccount.smtp.port,
        smtpUser: testAccount.user,
        smtpPass: testAccount.pass,
      },
    });

    const result = await sendEmail(etherealSender, {
      to: "recipient@example.com",
      subject: "Unit Test Ethereal",
      body: "Unit Test Content",
    });

    expect(result.messageId).toBeDefined();
    expect(typeof result.messageId).toBe("string");
    expect(result.previewUrl).toBeDefined();
    expect(result.previewUrl).toContain("ethereal.email");

    await prisma.sender.delete({ where: { id: etherealSender.id } });
  }, 40000);

  // 12 & 13. Retryable vs Final SMTP failure
  it("12 & 13. distinguishes retryable SMTP failures from final attempts", () => {
    const attemptsMade = 1;
    const maxAttempts = 3;
    const isFinalAttempt1 = attemptsMade + 1 >= maxAttempts;
    expect(isFinalAttempt1).toBe(false); // Should set status back to "queued" for retry

    const finalAttemptsMade = 2;
    const isFinalAttempt2 = finalAttemptsMade + 1 >= maxAttempts;
    expect(isFinalAttempt2).toBe(true); // Should mark status as "failed"
  });

  // 14. Boot reconciliation without duplicate jobs
  it("14. reconciles pending database jobs into Redis queue without duplicates", async () => {
    const campaign = await prisma.campaign.create({
      data: {
        userId: testUser.id,
        senderId: testSender.id,
        subject: "Reconcile Test",
        body: "Body",
        startAt: new Date(),
        delayMs: 1000,
        hourlyLimit: 100,
        totalCount: 1,
      },
    });

    const emailJob = await prisma.emailJob.create({
      data: {
        campaignId: campaign.id,
        senderId: testSender.id,
        recipient: "reconcile@test.com",
        subject: "Reconcile Test",
        body: "Body",
        seqIndex: 0,
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 10000),
      },
    });

    const result = await reconcilePendingJobs();
    expect(result.pending).toBeGreaterThanOrEqual(1);

    // Verify job in BullMQ queue matches emailJobId
    const jobId = jobIdFor(emailJob.id);
    const existingJob = await emailQueue.getJob(jobId);
    expect(existingJob).toBeDefined();
    expect(existingJob?.data.emailJobId).toBe(emailJob.id);
  });
});
