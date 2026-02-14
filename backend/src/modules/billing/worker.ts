import { billingService } from "./service";

// Worker interval: check for stale sessions every 30 seconds
const WORKER_INTERVAL_MS = 30 * 1000;

let workerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Process all stale sessions
 */
async function processAllStaleSessions(): Promise<void> {
  try {
    const activeSessions = await billingService.getActiveSessions();

    if (activeSessions.length === 0) {
      return;
    }

    console.log(
      `[Billing Worker] Checking ${activeSessions.length} active sessions...`,
    );

    for (const userId of activeSessions) {
      try {
        const result = await billingService.processStaleSession(userId);
        if (result) {
          console.log(
            `[Billing Worker] Settled stale session for user ${userId}:`,
            {
              amountSettled: result.amountSettled,
              watchTimeSettled: result.watchTimeSettled,
              success: result.success,
            },
          );
        }
      } catch (error) {
        console.error(
          `[Billing Worker] Error processing user ${userId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("[Billing Worker] Error in worker cycle:", error);
  }
}

/**
 * Start the billing settlement worker
 */
export function startBillingWorker(): void {
  if (workerInterval) {
    console.log("[Billing Worker] Worker already running");
    return;
  }

  console.log(
    `[Billing Worker] Starting worker (interval: ${WORKER_INTERVAL_MS / 1000}s)`,
  );

  // Run immediately on start
  processAllStaleSessions();

  // Then run at interval
  workerInterval = setInterval(processAllStaleSessions, WORKER_INTERVAL_MS);
}

/**
 * Stop the billing settlement worker
 */
export function stopBillingWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[Billing Worker] Worker stopped");
  }
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  return workerInterval !== null;
}
