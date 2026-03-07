import { t } from "elysia";

// Video status enum
export const VideoStatusEnum = t.Union([
  t.Literal("PENDING"),
  t.Literal("PROCESSING"),
  t.Literal("READY"),
  t.Literal("FAILED"),
]);

export type VideoStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

// Video schema for validation
export const VideoSchema = t.Object({
  id: t.String(),
  videoId: t.String(),
  title: t.Nullable(t.String()),
  mpdFileUrl: t.Nullable(t.String()),
  status: VideoStatusEnum,
  duration: t.Nullable(t.Number()),
  segmentCount: t.Nullable(t.Number()),
  errorMessage: t.Nullable(t.String()),
  creatorId: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

// Schema for video upload (no mpdFileUrl - will be generated)
export const UploadVideoSchema = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
});

export const CreateVideoSchema = t.Object({
  videoId: t.String({ minLength: 1 }),
  title: t.Optional(t.String()),
});

export const UpdateVideoSchema = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
});

export const VideoResponseSchema = t.Object({
  id: t.String(),
  videoId: t.String(),
  title: t.Nullable(t.String()),
  mpdFileUrl: t.Nullable(t.String()),
  status: VideoStatusEnum,
  duration: t.Nullable(t.Number()),
  segmentCount: t.Nullable(t.Number()),
  creatorId: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

// Video type definitions
export interface Video {
  id: string;
  videoId: string;
  title: string | null;
  mpdFileUrl: string | null;
  status: VideoStatus;
  duration: number | null;
  segmentCount: number | null;
  errorMessage: string | null;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVideoDTO {
  videoId: string;
  title?: string;
  creatorId: string;
}

export interface UpdateVideoDTO {
  title?: string;
}

export interface VideoResponse {
  id: string;
  videoId: string;
  title: string | null;
  mpdFileUrl: string | null;
  status: VideoStatus;
  duration: number | null;
  segmentCount: number | null;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoWithCreator extends Video {
  creator: {
    id: string;
    name: string;
    email: string;
    company: string | null;
  };
}
