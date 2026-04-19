import { config as loadEnv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getOperationalMetrics, processDueJobs } from "@agentic-room/domain";
import { logger } from "@agentic-room/observability";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "../../../.env") });

const pollMs = Number(process.env.WORKER_POLL_MS ?? 5000);
let active = false;

async function tick() {
  if (active) {
    return;
  }
  active = true;
  try {
    const result = await processDueJobs(25);
    if (result.count > 0) {
      logger.info("Worker processed jobs", result);
    }
  } catch (error) {
    logger.error("Worker tick failed", error);
  } finally {
    active = false;
  }
}

async function main() {
  const metrics = await getOperationalMetrics().catch(() => null);
  logger.info("Worker online", {
    pollMs,
    metrics
  });
  await tick();
  setInterval(() => {
    void tick();
  }, pollMs);
}

main().catch((error) => {
  logger.error("Worker failed", error);
  process.exit(1);
});
