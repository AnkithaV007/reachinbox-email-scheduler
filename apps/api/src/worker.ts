import { env } from "./config/env";
import { logger } from "./lib/logger";
import { startWorker } from "./queue/worker";
import { reconcilePendingJobs } from "./queue/reconcile";
import { prisma } from "./lib/prisma";

/** Worker-only entrypoint, for running senders as separate processes/containers. */
async function main() {
  if (env.RECONCILE_ON_BOOT) await reconcilePendingJobs();
  const worker = startWorker();

  const shutdown = async () => {
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  logger.error({ err }, "fatal worker boot error");
  process.exit(1);
});
