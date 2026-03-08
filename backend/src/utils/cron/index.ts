/**
 * Cron Scheduler
 *
 * Handles scheduled tasks like merkle tree updates
 */

import { Cron } from "croner";
import { generateAndUpdateMerkleRoot } from "../../services/merkle.service";

// Store cron job references for cleanup
const jobs: Cron[] = [];

/**
 * Initialize and start all cron jobs
 */
export function startCronJobs(): void {
  const merkleSchedule = process.env.MERKLE_UPDATE_CRON || "0 * * * *"; // Default: every hour
  const enableMerkleCron = process.env.ENABLE_MERKLE_CRON !== "false";

  if (!enableMerkleCron) {
    console.log("[Cron] Merkle update cron is disabled");
    return;
  }

  console.log(`[Cron] Starting merkle update scheduler: ${merkleSchedule}`);

  const merkleJob = new Cron(merkleSchedule, async () => {
    console.log(
      `[Cron] Running merkle tree update at ${new Date().toISOString()}`,
    );

    try {
      const result = await generateAndUpdateMerkleRoot();

      if (result.success) {
        console.log(
          `[Cron] Merkle update successful - Root: ${result.root}, Creators: ${result.creatorsProcessed}`,
        );
      } else {
        console.error(`[Cron] Merkle update failed: ${result.error}`);
      }
    } catch (error) {
      console.error("[Cron] Merkle update error:", error);
    }
  });

  jobs.push(merkleJob);

  // Log next scheduled run
  const nextRun = merkleJob.nextRun();
  if (nextRun) {
    console.log(
      `[Cron] Next merkle update scheduled for: ${nextRun.toISOString()}`,
    );
  }
}

/**
 * Stop all cron jobs
 */
export function stopCronJobs(): void {
  console.log("[Cron] Stopping all cron jobs...");
  for (const job of jobs) {
    job.stop();
  }
  jobs.length = 0;
}

/**
 * Manually trigger merkle update (useful for testing)
 */
export async function triggerMerkleUpdate() {
  console.log(
    `[Cron] Manual merkle update triggered at ${new Date().toISOString()}`,
  );
  return generateAndUpdateMerkleRoot();
}
