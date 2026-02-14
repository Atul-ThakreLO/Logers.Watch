import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { videoService } from "./service";
import { JWT_CONFIG } from "../../utils/jwt";
import { CreateVideoSchema, UpdateVideoSchema } from "./model";
import { resolve, join } from "path";
import { readFile, stat } from "fs/promises";
import { billingService } from "../billing/service";
import { sendBalanceUpdate } from "../billing/websocket";

// Public folder path for video files
const PUBLIC_FOLDER = resolve(process.cwd(), "public");

// JWT Payload for creator
interface CreatorJWTPayload {
  sub: string;
  email: string;
  name: string;
  type: "creator_access" | "creator_refresh";
  iat?: number;
  exp?: number;
}

// JWT Payload for user
interface UserJWTPayload {
  sub: string;
  email: string;
  name: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

// Type for authenticated creator context
type CreatorAuthContext = {
  creatorId: string | null;
  creatorEmail: string | null;
  creatorName: string | null;
};

// Creator auth middleware for video routes
const creatorAuthMiddleware = new Elysia({ name: "video-creator-auth" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .use(cookie())
  .derive(async ({ jwt, cookie, request }): Promise<CreatorAuthContext> => {
    const authHeader = request.headers.get("authorization");
    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else {
      const accessTokenCookie = cookie.creatorAccessToken as
        | { value?: string }
        | undefined;
      if (accessTokenCookie?.value) {
        token = accessTokenCookie.value;
      }
    }

    if (!token) {
      return { creatorId: null, creatorEmail: null, creatorName: null };
    }

    try {
      const payload = (await jwt.verify(token)) as CreatorJWTPayload | false;
      if (!payload || payload.type !== "creator_access") {
        return { creatorId: null, creatorEmail: null, creatorName: null };
      }

      return {
        creatorId: payload.sub,
        creatorEmail: payload.email,
        creatorName: payload.name,
      };
    } catch {
      return { creatorId: null, creatorEmail: null, creatorName: null };
    }
  });

// Type for authenticated user context
type UserAuthContext = {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
};

// User auth middleware for streaming routes
const userAuthMiddleware = new Elysia({ name: "video-user-auth" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .use(cookie())
  .derive(async ({ jwt, cookie, request }): Promise<UserAuthContext> => {
    const authHeader = request.headers.get("authorization");
    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else {
      const accessTokenCookie = cookie.accessToken as
        | { value?: string }
        | undefined;
      if (accessTokenCookie?.value) {
        token = accessTokenCookie.value;
      }
    }

    if (!token) {
      return { userId: null, userEmail: null, userName: null };
    }

    try {
      const payload = (await jwt.verify(token)) as UserJWTPayload | false;
      if (!payload || payload.type !== "access") {
        return { userId: null, userEmail: null, userName: null };
      }

      return {
        userId: payload.sub,
        userEmail: payload.email,
        userName: payload.name,
      };
    } catch {
      return { userId: null, userEmail: null, userName: null };
    }
  });

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
    "/stream/:videoId/manifest.mpd",
    async (ctx) => {
      const { params, userId, set } = ctx as typeof ctx & UserAuthContext;

      if (!userId) {
        set.status = 401;
        set.headers["Access-Control-Allow-Origin"] = "http://localhost:3001";
        set.headers["Access-Control-Allow-Credentials"] = "true";
        return { error: "Unauthorized - Please login to access video content" };
      }

      // Verify video exists and get creator info
      const video = await videoService.findByVideoId(params.videoId);
      if (!video) {
        set.status = 404;
        set.headers["Access-Control-Allow-Origin"] = "http://localhost:3001";
        set.headers["Access-Control-Allow-Credentials"] = "true";
        return { error: "Video not found" };
      }

      // Start or update watch session on manifest request
      await billingService.startSession(userId, params.videoId);

      try {
        const mpdPath = join(
          PUBLIC_FOLDER,
          params.videoId,
          "animal_manifest.mpd",
        );

        // Check if file exists
        await stat(mpdPath);

        const content = await readFile(mpdPath);

        return new Response(content, {
          headers: {
            "Content-Type": "application/dash+xml",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "http://localhost:3001",
            "Access-Control-Allow-Credentials": "true",
          },
        });
      } catch (error) {
        set.status = 404;
        set.headers["Access-Control-Allow-Origin"] = "http://localhost:3001";
        set.headers["Access-Control-Allow-Credentials"] = "true";
        return { error: "MPD file not found" };
      }
    },
    {
      params: t.Object({
        videoId: t.String(),
      }),
      detail: {
        summary: "Get MPD manifest file (verified users only)",
        tags: ["Video Streaming"],
      },
    },
  )
  .get(
    "/stream/:videoId/:segmentName",
    async (ctx) => {
      const { params, userId, set } = ctx as typeof ctx & UserAuthContext;

      if (!userId) {
        set.status = 401;
        set.headers["Access-Control-Allow-Origin"] = "http://localhost:3001";
        set.headers["Access-Control-Allow-Credentials"] = "true";
        return { error: "Unauthorized - Please login to access video content" };
      }

      // Validate segment name to prevent path traversal
      const segmentName = params.segmentName;
      if (
        segmentName.includes("..") ||
        segmentName.includes("/") ||
        segmentName.includes("\\")
      ) {
        set.status = 400;
        set.headers["Access-Control-Allow-Origin"] = "http://localhost:3001";
        set.headers["Access-Control-Allow-Credentials"] = "true";
        return { error: "Invalid segment name" };
      }

      // Only charge for video segment requests (.m4s files), not init segments
      const isVideoSegment =
        segmentName.endsWith(".m4s") && segmentName.includes("chunk-");

      if (isVideoSegment) {
        // Deduct balance for this request ($0.0002)
        const deductResult = await billingService.deductForRequest(userId);
        if (!deductResult.success) {
          set.status = 402; // Payment Required
          set.headers["Access-Control-Allow-Origin"] = "http://localhost:3001";
          set.headers["Access-Control-Allow-Credentials"] = "true";
          return { error: deductResult.error || "Insufficient balance" };
        }

        // Increment request count in session
        await billingService.incrementRequestCount(userId);

        // Send real-time balance update via WebSocket
        const status = await billingService.getBillingStatus(userId);
        if (status) {
          sendBalanceUpdate(
            userId,
            status.pendingDeduction,
            status.effectiveBalance,
          );
        }
      }

      try {
        const segmentPath = join(PUBLIC_FOLDER, params.videoId, segmentName);

        // Check if file exists and get size
        const fileStat = await stat(segmentPath);

        const content = await readFile(segmentPath);
        const contentType = getContentType(segmentName);

        return new Response(content, {
          headers: {
            "Content-Type": contentType,
            "Content-Length": fileStat.size.toString(),
            // "Cache-Control": "public, max-age=31536000",
            "Access-Control-Allow-Origin": "http://localhost:3001",
            "Access-Control-Allow-Credentials": "true",
          },
        });
      } catch (error) {
        set.status = 404;
        set.headers["Access-Control-Allow-Origin"] = "http://localhost:3001";
        set.headers["Access-Control-Allow-Credentials"] = "true";
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
