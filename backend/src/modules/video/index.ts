import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { videoService } from "./service";
import { JWT_CONFIG } from "../../utils/jwt";
import {
  CreateVideoSchema,
  UpdateVideoSchema,
  UploadVideoSchema,
} from "./model";
import { resolve, join } from "path";
import { readFile, stat, mkdir } from "fs/promises";
import { billingService } from "../billing/service";
import { sendBalanceUpdate } from "../billing/websocket";
import { addVideoProcessingJob, getJobStatus } from "../../utils/queue";
import {
  userAuthMiddleware,
  creatorAuthMiddleware,
  type UserAuthContext,
  type CreatorAuthContext,
} from "../../utils/middleware";

// Public folder path for video files
const PUBLIC_FOLDER = resolve(process.cwd(), "public");
// Temp folder for uploads
const TEMP_FOLDER = resolve(process.cwd(), "temp");
const SEGMENT_DURATION_SECONDS = 4;
const MPD_CACHE_TTL_MS = 5 * 60 * 1000;

type SegmentDurationCacheEntry = {
  bySegmentNumber: Map<number, number>;
  expiresAt: number;
};

const segmentDurationCache = new Map<string, SegmentDurationCacheEntry>();

function getXmlAttribute(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`${name}="([^"]+)"`));
  return match?.[1] ?? null;
}

function parseVideoSegmentDurationsFromMpd(
  mpdContent: string,
): { startNumber: number; durations: number[] } | null {
  const videoAdaptationMatch = mpdContent.match(
    /<AdaptationSet[^>]*contentType="video"[^>]*>([\s\S]*?)<\/AdaptationSet>/,
  );
  if (!videoAdaptationMatch) return null;

  const segmentTemplateMatch = videoAdaptationMatch[1].match(
    /<SegmentTemplate([^>]*)>([\s\S]*?)<\/SegmentTemplate>/,
  );
  if (!segmentTemplateMatch) return null;

  const templateAttrs = segmentTemplateMatch[1];
  const segmentTemplateBody = segmentTemplateMatch[2];
  const mediaTemplate = getXmlAttribute(templateAttrs, "media") ?? "";
  const timescaleRaw = getXmlAttribute(templateAttrs, "timescale");
  const startNumberRaw = getXmlAttribute(templateAttrs, "startNumber");

  // We bill only stream0 video chunks in /stream route.
  if (
    !mediaTemplate.includes("chunk-stream$RepresentationID$-$Number%05d$.m4s")
  ) {
    return null;
  }

  const timescale = Number.parseInt(timescaleRaw ?? "", 10);
  if (!Number.isFinite(timescale) || timescale <= 0) return null;

  const startNumber = Number.parseInt(startNumberRaw ?? "1", 10) || 1;
  const timelineMatch = segmentTemplateBody.match(
    /<SegmentTimeline>([\s\S]*?)<\/SegmentTimeline>/,
  );
  if (!timelineMatch) return null;

  const durations: number[] = [];
  const sTagRegex = /<S([^>]*)\/>/g;
  let sTagMatch: RegExpExecArray | null;

  while ((sTagMatch = sTagRegex.exec(timelineMatch[1])) !== null) {
    const sAttrs = sTagMatch[1];
    const dRaw = getXmlAttribute(sAttrs, "d");
    if (!dRaw) continue;

    const d = Number.parseInt(dRaw, 10);
    if (!Number.isFinite(d) || d <= 0) continue;

    const rRaw = getXmlAttribute(sAttrs, "r");
    const r = rRaw ? Number.parseInt(rRaw, 10) : 0;
    const repeatCount = Number.isFinite(r) && r >= 0 ? r + 1 : 1;

    const segmentDurationSeconds = d / timescale;
    for (let i = 0; i < repeatCount; i++) {
      durations.push(segmentDurationSeconds);
    }
  }

  if (durations.length === 0) return null;

  return { startNumber, durations };
}

async function getSegmentDurationSeconds(
  videoId: string,
  segmentName: string,
): Promise<number> {
  const segmentNumberMatch = segmentName.match(/chunk-stream0-(\d+)\.m4s$/);
  if (!segmentNumberMatch) return SEGMENT_DURATION_SECONDS;

  const segmentNumber = Number.parseInt(segmentNumberMatch[1], 10);
  if (!Number.isFinite(segmentNumber) || segmentNumber < 1) {
    return SEGMENT_DURATION_SECONDS;
  }

  const now = Date.now();
  const cached = segmentDurationCache.get(videoId);
  if (cached && cached.expiresAt > now) {
    return (
      cached.bySegmentNumber.get(segmentNumber) ?? SEGMENT_DURATION_SECONDS
    );
  }

  try {
    const mpdPath = join(PUBLIC_FOLDER, videoId, "manifest.mpd");
    const mpdContent = await readFile(mpdPath, "utf-8");
    const parsed = parseVideoSegmentDurationsFromMpd(mpdContent);
    if (!parsed) return SEGMENT_DURATION_SECONDS;

    const bySegmentNumber = new Map<number, number>();
    for (let i = 0; i < parsed.durations.length; i++) {
      bySegmentNumber.set(parsed.startNumber + i, parsed.durations[i]);
    }

    segmentDurationCache.set(videoId, {
      bySegmentNumber,
      expiresAt: now + MPD_CACHE_TTL_MS,
    });

    return bySegmentNumber.get(segmentNumber) ?? SEGMENT_DURATION_SECONDS;
  } catch {
    return SEGMENT_DURATION_SECONDS;
  }
}

function normalizeJobProgress(
  state: string,
  rawProgress: unknown,
): { state: string; progress: number } {
  const numericProgress =
    typeof rawProgress === "number"
      ? rawProgress
      : Number.parseInt(String(rawProgress ?? 0), 10) || 0;

  const clamped = Math.min(100, Math.max(0, numericProgress));

  // BullMQ jobs can remain at 0 for a while in waiting/active states.
  // Return a small floor to communicate liveness in UI.
  if (state === "waiting" || state === "delayed") {
    return { state, progress: Math.max(clamped, 5) };
  }

  if (state === "active") {
    return { state, progress: Math.max(clamped, 10) };
  }

  if (state === "completed") {
    return { state, progress: 100 };
  }

  return { state, progress: clamped };
}

// Helper to get content type for video files
function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mpd":
      return "application/dash+xml";
    case "m4s":
      return "video/iso.segment";
    case "mp4":
      return "video/mp4";
    case "m4a":
      return "audio/mp4";
    case "m4v":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
}

export const videoController = new Elysia({ prefix: "/videos" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .use(cookie())
  // Public routes
  .get(
    "/",
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Math.min(Number(query.limit) || 20, 100);

      const result = await videoService.getAll(page, limit);

      return {
        videos: result.videos,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        summary: "Get all videos with pagination",
        tags: ["Video"],
      },
    },
  )
  .get(
    "/v/:videoId",
    async ({ params, set }) => {
      const video = await videoService.getByVideoIdWithCreator(params.videoId);
      if (!video) {
        set.status = 404;
        return { error: "Video not found" };
      }

      return { video };
    },
    {
      params: t.Object({
        videoId: t.String(),
      }),
      detail: {
        summary: "Get video by videoId",
        tags: ["Video"],
      },
    },
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const video = await videoService.getWithCreator(params.id);
      if (!video) {
        set.status = 404;
        return { error: "Video not found" };
      }

      return { video };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Get video by ID",
        tags: ["Video"],
      },
    },
  )
  // Protected streaming routes (verified users only)
  .use(userAuthMiddleware)
  .get(
    "/stream/:videoId/:segmentName",
    async (ctx) => {
      const { params, userId, set } = ctx as typeof ctx & UserAuthContext;

      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized - Please login to access video content" };
      }

      const segmentName = params.segmentName;

      // Prevent path traversal
      if (
        segmentName.includes("..") ||
        segmentName.includes("/") ||
        segmentName.includes("\\")
      ) {
        set.status = 400;
        return { error: "Invalid segment name" };
      }

      // ── Billing gate ──────────────────────────────────────────────────────
      //
      // Only charge for VIDEO media segments (.m4s), not:
      //   - Audio segments  (would double-charge every second of playback)
      //   - Init segments   (.mp4 headers, requested once per track, not billed)
      //   - Manifest        (handled in the /manifest.mpd route)
      //
      // HOW TO IDENTIFY VIDEO vs AUDIO:
      // Most packagers embed the stream type in the filename. Common patterns:
      //
      //   FFmpeg DASH:        chunk-stream0-NNNNN.m4s (video=stream0, audio=stream1)
      //   Shaka Packager:     video-chunk-NNN.m4s / audio-chunk-NNN.m4s
      //   MP4Box:             video_dashinit.mp4, video_dash1.m4s
      //
      // The safest approach: check the filename contains "video" OR matches
      // the video stream index your transcoder uses. Adjust the regex below.
      //
      // If you're unsure, add a temporary log to see ALL segment names:
      //   console.log('[Segment]', segmentName);
      // Then watch what fires during playback in your server logs.

      const isMediaSegment = segmentName.endsWith(".m4s");

      // Adjust this pattern to match YOUR packager's video segment names.
      // Examples shown — uncomment the one that fits:
      //
      // FFmpeg (default stream ordering — video=stream0):
      const isVideoSegment =
        isMediaSegment && /chunk-stream0-\d+\.m4s/.test(segmentName);
      //
      // Shaka Packager:
      // const isVideoSegment = isMediaSegment && segmentName.includes("video");
      //
      // Generic "not audio" fallback (if your names don't have "video"/"audio"):
      // const isVideoSegment = isMediaSegment && !segmentName.includes("stream1");

      if (isVideoSegment) {
        const billedSeconds = await getSegmentDurationSeconds(
          params.videoId,
          segmentName,
        );

        const deductResult = await billingService.deductForDuration(
          userId,
          billedSeconds,
        );
        if (!deductResult.success) {
          set.status = 402;
          return { error: deductResult.error || "Insufficient balance" };
        }

        // Creator watch time is counted from actual segment duration.
        const video = await videoService.findByVideoId(params.videoId);
        if (video) {
          await billingService.addCreatorWatchTime(
            video.creatorId,
            billedSeconds,
          );
        }

        await billingService.incrementRequestCount(userId);

        // Fire-and-forget balance update via WebSocket — don't await
        billingService.getBillingStatus(userId).then((status) => {
          if (status)
            sendBalanceUpdate(
              userId,
              status.pendingDeduction,
              status.effectiveBalance,
            );
        });
      }

      try {
        const segmentPath = join(PUBLIC_FOLDER, params.videoId, segmentName);
        const fileStat = await stat(segmentPath);
        const content = await readFile(segmentPath);
        const contentType = getContentType(segmentName);

        return new Response(content, {
          headers: {
            "Content-Type": contentType,
            "Content-Length": fileStat.size.toString(),
          },
        });
      } catch {
        set.status = 404;
        return { error: "Segment not found" };
      }
    },
    {
      params: t.Object({
        videoId: t.String(),
        segmentName: t.String(),
      }),
      detail: {
        summary: "Get video segment (verified users only)",
        tags: ["Video Streaming"],
      },
    },
  )
  // Protected routes (creator only)
  .use(creatorAuthMiddleware)
  // Upload video endpoint - streams file to temp and queues for processing
  .post(
    "/upload",
    async (ctx) => {
      const { body, creatorId, set } = ctx as typeof ctx &
        CreatorAuthContext & {
          body: { video: File; title?: string };
        };

      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const videoFile = body.video;
      if (!videoFile || !(videoFile instanceof File)) {
        set.status = 400;
        return { error: "No video file provided" };
      }

      // Validate file type
      const allowedTypes = [
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-msvideo",
      ];
      if (!allowedTypes.includes(videoFile.type)) {
        set.status = 400;
        return { error: "Invalid file type. Allowed: mp4, webm, mov, avi" };
      }

      // Max file size: 2GB
      const maxSize = 2 * 1024 * 1024 * 1024;
      if (videoFile.size > maxSize) {
        set.status = 400;
        return { error: "File too large. Maximum size: 2GB" };
      }

      try {
        // Generate videoId
        const videoId = videoService.generateVideoId();

        // Ensure temp directory exists
        await mkdir(TEMP_FOLDER, { recursive: true });

        // Save file to temp (Bun streams to disk efficiently)
        const tempFilePath = join(TEMP_FOLDER, `${videoId}.mp4`);
        await Bun.write(tempFilePath, videoFile);

        // Create video record in DB with PENDING status
        const video = await videoService.create({
          videoId,
          title: body.title,
          creatorId,
        });

        // Output directory for processed video
        const outputDir = join(PUBLIC_FOLDER, videoId);

        // Queue video for processing
        await addVideoProcessingJob({
          videoId,
          tempFilePath,
          outputDir,
          creatorId,
        });

        set.status = 202; // Accepted
        return {
          message: "Video uploaded successfully. Processing started.",
          video: {
            id: video.id,
            videoId: video.videoId,
            title: video.title,
            status: video.status,
          },
        };
      } catch (error) {
        set.status = 500;
        return {
          error:
            error instanceof Error ? error.message : "Failed to upload video",
        };
      }
    },
    {
      body: t.Object({
        video: t.File(),
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
      }),
      detail: {
        summary: "Upload video for processing (creator only)",
        description:
          "Upload a video file. It will be processed in the background and converted to DASH format.",
        tags: ["Video Upload"],
      },
    },
  )
  // Get video processing status
  .get(
    "/status/:videoId",
    async (ctx) => {
      const { params, creatorId, set } = ctx as typeof ctx & CreatorAuthContext;

      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const video = await videoService.findByVideoId(params.videoId);
      if (!video) {
        set.status = 404;
        return { error: "Video not found" };
      }

      // Verify ownership
      if (video.creatorId !== creatorId) {
        set.status = 403;
        return { error: "Not authorized to view this video" };
      }

      // Get job status from queue if pending/processing
      let jobProgress = null;
      if (video.status === "PENDING" || video.status === "PROCESSING") {
        const job = await getJobStatus(params.videoId);
        if (job) {
          jobProgress = normalizeJobProgress(job.state, job.progress);
        }
      }

      return {
        video: {
          id: video.id,
          videoId: video.videoId,
          title: video.title,
          status: video.status,
          duration: video.duration,
          segmentCount: video.segmentCount,
          errorMessage: video.errorMessage,
          mpdFileUrl: video.mpdFileUrl,
        },
        jobProgress,
      };
    },
    {
      params: t.Object({
        videoId: t.String(),
      }),
      detail: {
        summary: "Get video processing status (creator only)",
        tags: ["Video Upload"],
      },
    },
  )
  .get(
    "/pending",
    async (ctx) => {
      const { creatorId, set } = ctx as typeof ctx & CreatorAuthContext;

      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const videos = await videoService.getPendingByCreatorId(creatorId);

      const pendingVideos = await Promise.all(
        videos.map(async (video) => {
          let jobProgress = null;
          if (video.status === "PENDING" || video.status === "PROCESSING") {
            const job = await getJobStatus(video.videoId);
            if (job) {
              jobProgress = normalizeJobProgress(job.state, job.progress);
            }
          }
          return {
            video: {
              id: video.id,
              videoId: video.videoId,
              title: video.title,
              status: video.status,
            },
            jobProgress,
          };
        }),
      );

      return { videos: pendingVideos };
    },
    {
      detail: {
        summary: "Get all pending video processing jobs (creator only)",
        tags: ["Video Upload"],
      },
    },
  )
  .post(
    "/",
    async (ctx) => {
      const { body, creatorId, set } = ctx as typeof ctx & CreatorAuthContext;
      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const video = await videoService.create({
          ...body,
          creatorId,
        });
        set.status = 201;
        return {
          message: "Video created successfully",
          video,
        };
      } catch (error) {
        set.status = 400;
        return {
          error:
            error instanceof Error ? error.message : "Failed to create video",
        };
      }
    },
    {
      body: CreateVideoSchema,
      detail: {
        summary: "Create a new video (creator only)",
        tags: ["Video"],
      },
    },
  )
  .patch(
    "/:id",
    async (ctx) => {
      const { params, body, creatorId, set } = ctx as typeof ctx &
        CreatorAuthContext;
      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const video = await videoService.update(params.id, creatorId, body);
      if (!video) {
        set.status = 404;
        return { error: "Video not found or not authorized" };
      }

      return { video };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: UpdateVideoSchema,
      detail: {
        summary: "Update video (creator only)",
        tags: ["Video"],
      },
    },
  )
  .delete(
    "/:id",
    async (ctx) => {
      const { params, creatorId, set } = ctx as typeof ctx & CreatorAuthContext;
      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const deleted = await videoService.delete(params.id, creatorId);
      if (!deleted) {
        set.status = 404;
        return { error: "Video not found or not authorized" };
      }

      return { message: "Video deleted successfully" };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Delete video (creator only)",
        tags: ["Video"],
      },
    },
  );
