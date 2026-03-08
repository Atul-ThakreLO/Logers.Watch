/**
 * Video Processing Queue
 *
 * BullMQ queue for background video processing tasks
 */

import { Queue, type ConnectionOptions } from "bullmq";

// Redis connection for BullMQ
const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

// Video processing job data
export interface VideoJobData {
  videoId: string;
  tempFilePath: string;
  outputDir: string;
  creatorId: string;
}

// Video processing queue
export const videoQueue = new Queue<VideoJobData>("video-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  },
});

/**
 * Add a video processing job to the queue
 */
export async function addVideoProcessingJob(
  data: VideoJobData,
): Promise<string> {
  const job = await videoQueue.add("process-video", data, {
    jobId: data.videoId, // Use videoId as job ID for easy lookup
  });

  console.log(`[Queue] Added video processing job: ${job.id}`);
  return job.id || data.videoId;
}

/**
 * Get job status by videoId
 */
export async function getJobStatus(videoId: string) {
  const job = await videoQueue.getJob(videoId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  };
}

/**
 * Close queue connection
 */
export async function closeQueue(): Promise<void> {
  await videoQueue.close();
}
