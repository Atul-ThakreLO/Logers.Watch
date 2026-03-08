/**
 * FFmpeg Utility
 *
 * Handles video conversion to DASH format using FFmpeg
 */

import { spawn } from "child_process";
import { mkdir, unlink, readdir } from "fs/promises";
import { join } from "path";

export interface FFmpegResult {
  success: boolean;
  duration?: number;
  segmentCount?: number;
  mpdPath?: string;
  error?: string;
}

/**
 * Convert video to DASH format
 *
 * Creates:
 * - manifest.mpd (DASH manifest)
 * - init-stream0.m4s (video init segment)
 * - init-stream1.m4s (audio init segment)
 * - chunk-stream0-*.m4s (video chunks)
 * - chunk-stream1-*.m4s (audio chunks)
 */
export async function convertToDash(
  inputPath: string,
  outputDir: string,
  onProgress?: (percent: number) => void,
): Promise<FFmpegResult> {
  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  const mpdPath = join(outputDir, "manifest.mpd");

  // Get video duration first
  const duration = await getVideoDuration(inputPath);

  return new Promise((resolve) => {
    // FFmpeg command for DASH conversion
    // -c:v libx264 - H.264 video codec
    // -c:a aac - AAC audio codec
    // -bf 1 - B-frames
    // -keyint_min 120 -g 120 - Keyframe every 120 frames (4 seconds at 30fps)
    // -sc_threshold 0 - Disable scene change detection for consistent segments
    // -b:v 2500k - Video bitrate
    // -maxrate 2675k -bufsize 3750k - VBV buffering
    // -b:a 128k - Audio bitrate
    // -seg_duration 4 - 4 second segments
    // -adaptation_sets - Group video and audio streams
    const args = [
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-c:a",
      "aac",
      "-bf",
      "1",
      "-keyint_min",
      "120",
      "-g",
      "120",
      "-sc_threshold",
      "0",
      "-b:v",
      "2500k",
      "-maxrate",
      "2675k",
      "-bufsize",
      "3750k",
      "-b:a",
      "128k",
      "-ar",
      "44100",
      "-f",
      "dash",
      "-seg_duration",
      "4",
      "-init_seg_name",
      "init-stream$RepresentationID$.m4s",
      "-media_seg_name",
      "chunk-stream$RepresentationID$-$Number%05d$.m4s",
      "-adaptation_sets",
      "id=0,streams=v id=1,streams=a",
      "-use_timeline",
      "1",
      "-use_template",
      "1",
      "-y", // Overwrite output
      mpdPath,
    ];

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    let lastProgress = 0;

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();

      // Parse progress from FFmpeg output
      if (duration && onProgress) {
        const timeMatch = data.toString().match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = parseInt(timeMatch[3]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          const progress = Math.min(
            100,
            Math.round((currentTime / duration) * 100),
          );

          if (progress > lastProgress) {
            lastProgress = progress;
            onProgress(progress);
          }
        }
      }
    });

    ffmpeg.on("error", (err) => {
      resolve({
        success: false,
        error: `FFmpeg spawn error: ${err.message}`,
      });
    });

    ffmpeg.on("close", async (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: `FFmpeg exited with code ${code}: ${stderr.slice(-500)}`,
        });
        return;
      }

      // Count segments
      try {
        const files = await readdir(outputDir);
        const segmentCount = files.filter(
          (f) => f.startsWith("chunk-") && f.endsWith(".m4s"),
        ).length;

        resolve({
          success: true,
          duration: Math.round(duration || 0),
          segmentCount,
          mpdPath,
        });
      } catch (err) {
        resolve({
          success: false,
          error: `Failed to count segments: ${err}`,
        });
      }
    });
  });
}

/**
 * Get video duration using FFprobe
 */
export async function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    const args = [
      "-v",
      "quiet",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      inputPath,
    ];

    const ffprobe = spawn("ffprobe", args);
    let output = "";

    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0 && output.trim()) {
        resolve(parseFloat(output.trim()));
      } else {
        resolve(0);
      }
    });

    ffprobe.on("error", () => {
      resolve(0);
    });
  });
}

/**
 * Delete temporary file
 */
export async function deleteTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Ignore errors if file doesn't exist
  }
}

/**
 * Check if FFmpeg is available
 */
export async function checkFFmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", ["-version"]);

    ffmpeg.on("close", (code) => {
      resolve(code === 0);
    });

    ffmpeg.on("error", () => {
      resolve(false);
    });
  });
}
