import { prisma, cache, CacheKeys } from "../../utils/db";
import type {
  CreateVideoDTO,
  UpdateVideoDTO,
  VideoResponse,
  VideoWithCreator,
} from "./model";
import type { Video } from "../../generated/prisma/client";

// Cache TTL in seconds (10 minutes for videos)
const VIDEO_CACHE_TTL = 600;

export class VideoService {
  /**
   * Create a new video
   */
  async create(data: CreateVideoDTO): Promise<VideoResponse> {
    // Check if videoId already exists
    const existingVideo = await this.findByVideoId(data.videoId);
    if (existingVideo) {
      throw new Error("Video with this videoId already exists");
    }

    const video = await prisma.video.create({
      data: {
        videoId: data.videoId,
        mpdFileUrl: data.mpdFileUrl,
        creatorId: data.creatorId,
      },
    });

    // Cache the new video
    await cache.set(CacheKeys.video(video.id), video, VIDEO_CACHE_TTL);
    await cache.set(
      CacheKeys.videoByVideoId(video.videoId),
      video,
      VIDEO_CACHE_TTL,
    );

    // Invalidate creator's videos cache
    await cache.del(CacheKeys.creatorVideos(data.creatorId));

    return video;
  }

  /**
   * Find video by ID
   */
  async findById(id: string): Promise<Video | null> {
    // Try cache first
    const cached = await cache.get<Video>(CacheKeys.video(id));
    if (cached) return cached;

    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (video) {
      await cache.set(CacheKeys.video(id), video, VIDEO_CACHE_TTL);
    }

    return video;
  }

  /**
   * Find video by videoId (external identifier)
   */
  async findByVideoId(videoId: string): Promise<Video | null> {
    // Try cache first
    const cached = await cache.get<Video>(CacheKeys.videoByVideoId(videoId));
    if (cached) return cached;

    const video = await prisma.video.findUnique({
      where: { videoId },
    });

    if (video) {
      await cache.set(
        CacheKeys.videoByVideoId(videoId),
        video,
        VIDEO_CACHE_TTL,
      );
    }

    return video;
  }

  /**
   * Get video with creator info
   */
  async getWithCreator(id: string): Promise<VideoWithCreator | null> {
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },
      },
    });

    return video;
  }

  /**
   * Get video by videoId with creator info
   */
  async getByVideoIdWithCreator(
    videoId: string,
  ): Promise<VideoWithCreator | null> {
    const video = await prisma.video.findUnique({
      where: { videoId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },
      },
    });

    return video;
  }

  /**
   * Get all videos by creator ID
   */
  async getByCreatorId(creatorId: string): Promise<VideoResponse[]> {
    // Try cache first
    const cached = await cache.get<VideoResponse[]>(
      CacheKeys.creatorVideos(creatorId),
    );
    if (cached) return cached;

    const videos = await prisma.video.findMany({
      where: { creatorId },
      orderBy: { createdAt: "desc" },
    });

    await cache.set(
      CacheKeys.creatorVideos(creatorId),
      videos,
      VIDEO_CACHE_TTL,
    );

    return videos;
  }

  /**
   * Update video
   */
  async update(
    id: string,
    creatorId: string,
    data: UpdateVideoDTO,
  ): Promise<VideoResponse | null> {
    try {
      // Verify video belongs to creator
      const existingVideo = await this.findById(id);
      if (!existingVideo || existingVideo.creatorId !== creatorId) {
        return null;
      }

      const video = await prisma.video.update({
        where: { id },
        data,
      });

      // Invalidate and update cache
      await cache.del(CacheKeys.video(id));
      await cache.del(CacheKeys.videoByVideoId(video.videoId));
      await cache.del(CacheKeys.creatorVideos(creatorId));
      await cache.set(CacheKeys.video(id), video, VIDEO_CACHE_TTL);
      await cache.set(
        CacheKeys.videoByVideoId(video.videoId),
        video,
        VIDEO_CACHE_TTL,
      );

      return video;
    } catch {
      return null;
    }
  }

  /**
   * Delete video
   */
  async delete(id: string, creatorId: string): Promise<boolean> {
    try {
      // Verify video belongs to creator
      const existingVideo = await this.findById(id);
      if (!existingVideo || existingVideo.creatorId !== creatorId) {
        return false;
      }

      await prisma.video.delete({
        where: { id },
      });

      // Invalidate cache
      await cache.del(CacheKeys.video(id));
      await cache.del(CacheKeys.videoByVideoId(existingVideo.videoId));
      await cache.del(CacheKeys.creatorVideos(creatorId));

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all videos (with pagination)
   */
  async getAll(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ videos: VideoResponse[]; total: number }> {
    const skip = (page - 1) * limit;

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.video.count(),
    ]);

    return { videos, total };
  }
}

export const videoService = new VideoService();
