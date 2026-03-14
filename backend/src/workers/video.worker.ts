/**
 * Video Processing Worker
 *
 * Background worker that processes video conversion jobs
 * Can be run standalone: bun run src/workers/video.worker.ts
 * Or started with the server via startVideoWorker()
 */

import { Worker, type Job, type ConnectionOptions } from "bullmq";
import { convertToDash, deleteTempFile, checkFFmpeg } from "../utils/ffmpeg";
import { prisma } from "../utils/db";
import type { VideoJobData } from "../utils/queue";

// Redis connection for BullMQ
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

const connection: ConnectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

let worker: Worker<VideoJobData> | null = null;

/**
 * Process a video conversion job
 */
async function processVideo(job: Job<VideoJobData>): Promise<void> {
  const { videoId, tempFilePath, outputDir, creatorId } = job.data;

  console.log(`[Worker] Processing video: ${videoId}`);

  try {
    // Update status to PROCESSING
    await prisma.video.update({
      where: { videoId },
      data: { status: "PROCESSING" },
    });

    // Convert to DASH format
    const result = await convertToDash(
      tempFilePath,
      outputDir,
      async (percent) => {
        // Update job progress
        await job.updateProgress(percent);
        console.log(`[Worker] ${videoId} progress: ${percent}%`);
      },
    );

    if (!result.success) {
      throw new Error(result.error || "FFmpeg conversion failed");
    }

    // Update video record with results
    await prisma.video.update({
      where: { videoId },
      data: {
        status: "READY",
        mpdFileUrl: `/${videoId}/manifest.mpd`,
        duration: result.duration,
        segmentCount: result.segmentCount,
      },
    });

    console.log(
      `[Worker] Video ${videoId} completed - Duration: ${result.duration}s, Segments: ${result.segmentCount}`,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[Worker] Video ${videoId} failed:`, errorMessage);

    // Update status to FAILED
    await prisma.video.update({
      where: { videoId },
      data: {
        status: "FAILED",
        errorMessage,
      },
    });

    throw error;
  } finally {
    // Clean up temp file
    await deleteTempFile(tempFilePath);
    console.log(`[Worker] Cleaned up temp file: ${tempFilePath}`);
  }
}

/**
 * Start the video processing worker
 * Can be called from main server or run standalone
 */
export async function startVideoWorker(): Promise<Worker<VideoJobData> | null> {
  // Check FFmpeg availability
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    console.error("[Worker] FFmpeg not found! Video processing disabled.");
    console.error("[Worker] Install FFmpeg: sudo apt install ffmpeg");
    return null;
  }

  // Create worker if not already running
  if (!worker) {
    worker = new Worker<VideoJobData>("video-processing", processVideo, {
      connection,
      concurrency: parseInt(process.env.VIDEO_WORKER_CONCURRENCY || "2"),
    });

    // Worker event handlers
    worker.on("completed", (job) => {
      console.log(`[Worker] Job ${job.id} completed successfully`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[Worker] Job ${job?.id} failed:`, err.message);
    });

    worker.on("error", (err) => {
      console.error("[Worker] Worker error:", err);
    });

    console.log("[Worker] Video processing worker started");
    console.log(
      `[Worker] Concurrency: ${process.env.VIDEO_WORKER_CONCURRENCY || "2"}`,
    );
    console.log(`[Worker] Connected to Redis: ${REDIS_HOST}:${REDIS_PORT}`);
  }

  return worker;
}

/**
 * Stop the video processing worker
 */
export async function stopVideoWorker(): Promise<void> {
  if (worker) {
    console.log("[Worker] Shutting down...");
    await worker.close();
    worker = null;
  }
}

// If running as standalone script
const isStandalone = import.meta.url === `file://${process.argv[1]}`;
if (isStandalone) {
  // Graceful shutdown for standalone mode
  const shutdown = async () => {
    await stopVideoWorker();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Start worker
  startVideoWorker().then((w) => {
    if (!w) {
      process.exit(1);
    }
  });
}
