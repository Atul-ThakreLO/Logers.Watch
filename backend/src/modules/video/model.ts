import { t } from "elysia";

// Video schema for validation
export const VideoSchema = t.Object({
  id: t.String(),
  videoId: t.String(),
  mpdFileUrl: t.String(),
  creatorId: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

export const CreateVideoSchema = t.Object({
  videoId: t.String({ minLength: 1 }),
  mpdFileUrl: t.String({ format: "uri" }),
});

export const UpdateVideoSchema = t.Object({
  mpdFileUrl: t.Optional(t.String({ format: "uri" })),
});

export const VideoResponseSchema = t.Object({
  id: t.String(),
  videoId: t.String(),
  mpdFileUrl: t.String(),
  creatorId: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

// Video type definitions
export interface Video {
  id: string;
  videoId: string;
  mpdFileUrl: string;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVideoDTO {
  videoId: string;
  mpdFileUrl: string;
  creatorId: string;
}

export interface UpdateVideoDTO {
  mpdFileUrl?: string;
}

export interface VideoResponse {
  id: string;
  videoId: string;
  mpdFileUrl: string;
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
