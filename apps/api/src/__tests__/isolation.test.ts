import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../lib/prisma";

const app = createApp();

describe("User Data Isolation & Ownership Security Test Suite", () => {
  const tokenA = "mock-token-user-a";
  const tokenB = "mock-token-user-b";

  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let campaignAId: string;
  let campaignBId: string;
  let sentJobAId: string;
  let sentJobBId: string;
  let scheduledJobAId: string;

  beforeAll(async () => {
    // Authenticate both users via mock Bearer tokens to provision database rows
    const resA = await request(app).get("/api/me").set("Authorization", `Bearer ${tokenA}`);
    userA = resA.body;

    const resB = await request(app).get("/api/me").set("Authorization", `Bearer ${tokenB}`);
    userB = resB.body;

    expect(userA.id).toBeDefined();
    expect(userB.id).toBeDefined();
    expect(userA.id).not.toEqual(userB.id);
  });

  afterAll(async () => {
    // Cleanup test data
    if (userA?.id && userB?.id) {
      await prisma.emailJob.deleteMany({
        where: { campaign: { userId: { in: [userA.id, userB.id] } } },
      }).catch(() => undefined);
      await prisma.campaign.deleteMany({
        where: { userId: { in: [userA.id, userB.id] } },
      }).catch(() => undefined);
      await prisma.user.deleteMany({
        where: { id: { in: [userA.id, userB.id] } },
      }).catch(() => undefined);
    }
  });

  // 1 & 8. User A creates a campaign and it automatically associates with User A's ID
  it("1 & 8. automatically associates created campaign with authenticated User A", async () => {
    const res = await request(app)
      .post("/api/campaigns")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        subject: "User A Campaign",
        body: "User A Body",
        recipients: ["lead-a1@test.com", "lead-a2@test.com"],
        startAt: new Date(Date.now() + 10000).toISOString(),
        delayMs: 2000,
        hourlyLimit: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.campaignId).toBeDefined();
    campaignAId = res.body.campaignId;

    const dbCampaign = await prisma.campaign.findUnique({ where: { id: campaignAId } });
    expect(dbCampaign?.userId).toBe(userA.id);

    const jobs = await prisma.emailJob.findMany({ where: { campaignId: campaignAId } });
    sentJobAId = jobs[0].id;
    scheduledJobAId = jobs[1].id;
  });

  // 2. User A can see its scheduled emails
  it("2. allows User A to see their own scheduled emails", async () => {
    const res = await request(app)
      .get("/api/emails/scheduled")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    expect(res.body.items.every((item: any) => item.subject === "User A Campaign")).toBe(true);
  });

  // 3. User B cannot see User A's scheduled emails
  it("3. prevents User B from seeing User A's scheduled emails", async () => {
    const res = await request(app)
      .get("/api/emails/scheduled")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0); // User B has 0 scheduled emails
  });

  // 4. User B cannot see User A's sent emails
  it("4. prevents User B from seeing User A's sent emails", async () => {
    // Mark ONLY sentJobAId as sent, leaving scheduledJobAId as scheduled
    await prisma.emailJob.update({
      where: { id: sentJobAId },
      data: { status: "sent", sentAt: new Date() },
    });

    const resB = await request(app)
      .get("/api/emails/sent")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(resB.status).toBe(200);
    expect(resB.body.items.length).toBe(0); // User B sees 0 sent emails from User A

    // User A can see their sent email
    const resA = await request(app)
      .get("/api/emails/sent")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(resA.status).toBe(200);
    expect(resA.body.items.some((item: any) => item.id === sentJobAId)).toBe(true);
  });

  // 5. User B cannot cancel/delete User A's campaign
  it("5. prevents User B from cancelling or deleting User A's campaign (IDOR protection)", async () => {
    const res = await request(app)
      .delete(`/api/campaigns/${campaignAId}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(404); // Campaign not found or access denied for User B
    expect(res.body.error).toContain("Campaign not found or access denied");
  });

  // 6. User B's statistics do not include User A's data
  it("6. verifies User B's stats are isolated from User A's data", async () => {
    const resB = await request(app)
      .get("/api/stats")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(resB.status).toBe(200);
    expect(resB.body.sent ?? 0).toBe(0); // User B stats show 0

    const resA = await request(app)
      .get("/api/stats")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(resA.status).toBe(200);
    expect(resA.body.sent).toBeGreaterThanOrEqual(1);
  });

  // 7. User B cannot delete User A's sent email record
  it("7. prevents User B from deleting User A's sent email record (IDOR protection)", async () => {
    const res = await request(app)
      .delete(`/api/emails/sent/${sentJobAId}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Email history record not found or access denied");

    // Verify row still exists in DB
    const dbJob = await prisma.emailJob.findUnique({ where: { id: sentJobAId } });
    expect(dbJob).not.toBeNull();
  });

  // 8. User A can delete their own sent email record
  it("8. allows User A to delete their own sent email record", async () => {
    const res = await request(app)
      .delete(`/api/emails/sent/${sentJobAId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const dbJob = await prisma.emailJob.findUnique({ where: { id: sentJobAId } });
    expect(dbJob).toBeNull();
  });

  // 9. Bulk clear sent history for User B does not affect User A
  it("9. verifies bulk clear sent history is strictly user-isolated and preserves scheduled jobs", async () => {
    // Provision sent job for User B
    const campaignBRes = await request(app)
      .post("/api/campaigns")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        subject: "User B Campaign",
        body: "User B Body",
        recipients: ["lead-b1@test.com"],
        startAt: new Date(Date.now() + 10000).toISOString(),
      });
    campaignBId = campaignBRes.body.campaignId;

    const jobsB = await prisma.emailJob.findMany({ where: { campaignId: campaignBId } });
    sentJobBId = jobsB[0].id;
    await prisma.emailJob.update({
      where: { id: sentJobBId },
      data: { status: "sent", sentAt: new Date() },
    });

    // Clear Sent History for User B
    const clearResB = await request(app)
      .delete("/api/emails/sent")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(clearResB.status).toBe(200);
    expect(clearResB.body.deleted).toBeGreaterThanOrEqual(1);

    // Verify User B's sent job is deleted
    const dbJobB = await prisma.emailJob.findUnique({ where: { id: sentJobBId } });
    expect(dbJobB).toBeNull();

    // Verify User A's scheduled job is NOT deleted by User B's clear action
    const dbJobA = await prisma.emailJob.findUnique({ where: { id: scheduledJobAId } });
    expect(dbJobA).not.toBeNull();
  });
});
