import { Queue, QueueEvents } from "bullmq";
import { createRedis } from "../lib/redis";
import { env } from "../config/env";

export type EmailJobData = {
  emailJobId: string;
  senderId: string;
  campaignId: string;
  seqIndex: number;
  hourlyLimit: number;
};

export const emailQueue = new Queue<EmailJobData>(env.QUEUE_NAME, {
  connection: createRedis(),
  defaultJobOptions: {
    attempts: env.JOB_MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: env.JOB_BACKOFF_MS },
    // Keep a window of history for the dashboard, but do not let Redis grow forever.
    removeOnComplete: { age: 24 * 3600, count: 5000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export const emailQueueEvents = new QueueEvents(env.QUEUE_NAME, {
  connection: createRedis(),
});

/**
 * jobId is the EmailJob primary key. BullMQ ignores an add() for a jobId that
 * already exists, so replaying an enqueue (retry, reconcile, double API call)
 * can never create a second job for the same recipient row.
 */
export const jobIdFor = (emailJobId: string) => `email-${emailJobId}`;
