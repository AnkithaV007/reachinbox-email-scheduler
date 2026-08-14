import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { ensureSenders } from "./services/mailer";
import { reconcilePendingJobs } from "./queue/reconcile";
import { startWorker } from "./queue/worker";
import { prisma } from "./lib/prisma";

/**
 * Single-process entrypoint: API + worker together, which is what you want for
 * local dev and the demo. Run `pnpm start:worker` separately to scale workers
 * horizontally -- the limiter and rate counters are Redis-backed, so N worker
 * processes behave correctly without any further coordination.
 */
async function main() {
  await ensureSenders();
  if (env.RECONCILE_ON_BOOT) await reconcilePendingJobs();

  const worker = startWorker();
  const server = createApp().listen(env.PORT, () =>
    logger.info({ port: env.PORT }, "API listening")
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close();
    // close() waits for in-flight sends to finish so nothing is left mid-claim.
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "fatal boot error");
  process.exit(1);
});
