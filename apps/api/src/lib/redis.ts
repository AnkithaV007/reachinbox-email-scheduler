import IORedis from "ioredis";
import { env } from "../config/env";

/** BullMQ requires maxRetriesPerRequest: null on any connection a Worker blocks on. */
export function createRedis() {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export const redis = createRedis();
