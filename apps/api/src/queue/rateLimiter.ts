import { redis } from "../lib/redis";

/**
 * Fixed-window per-sender hourly counter.
 *
 * INCR + conditional DECR in a single Lua script so the check and the reserve
 * are atomic. Any number of API instances and workers share the same counter,
 * so this holds across processes -- an in-memory counter would not.
 *
 * Returns remaining quota (>= 0) if the token was reserved, or -1 if the
 * window is full.
 */
const RESERVE = `
local key   = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl   = tonumber(ARGV[2])

local used = redis.call('INCR', key)
if used == 1 then
  redis.call('EXPIRE', key, ttl)
end
if used > limit then
  redis.call('DECR', key)
  return -1
end
return limit - used
`;

const HOUR_MS = 3600_000;

export const windowIdFor = (at: number) => Math.floor(at / HOUR_MS);
export const windowKey = (senderId: string, at: number) =>
  `rl:sender:${senderId}:${windowIdFor(at)}`;
export const nextWindowStart = (at: number) => (windowIdFor(at) + 1) * HOUR_MS;

/** Try to reserve one send for this sender in the current hour window. */
export async function reserveSlot(
  senderId: string,
  limit: number,
  at = Date.now()
): Promise<{ allowed: boolean; remaining: number }> {
  const res = (await redis.eval(
    RESERVE,
    1,
    windowKey(senderId, at),
    String(limit),
    // Two hours of TTL so a key is never reaped while its window is still current.
    String(7200)
  )) as number;
  return { allowed: res >= 0, remaining: res >= 0 ? res : 0 };
}

/**
 * Give a reserved token back. Called when a send fails in a way that never
 * touched the provider, so a doomed job does not silently eat quota.
 */
export async function releaseSlot(senderId: string, at = Date.now()) {
  const key = windowKey(senderId, at);
  const used = await redis.get(key);
  if (used && Number(used) > 0) await redis.decr(key);
}

export async function usageFor(senderId: string, at = Date.now()) {
  const used = await redis.get(windowKey(senderId, at));
  return Number(used ?? 0);
}
