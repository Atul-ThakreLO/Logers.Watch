import apiClient from "./client";

export interface Video {
  id: string;
  videoId: string;
  mpdFileUrl: string;
  creatorId: string;
  creator?: {
    id: string;
    name: string;
    company?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface VideoListParams {
  page?: number;
  limit?: number;
  creatorId?: string;
}

export const videoService = {
  async getAll(params?: VideoListParams): Promise<{ videos: Video[] }> {
    const response = await apiClient.get<{ videos: Video[] }>("/videos", {
      params,
    });
    return response.data;
  },

  async getById(id: string): Promise<{ video: Video }> {
    const response = await apiClient.get<{ video: Video }>(`/videos/${id}`);
    return response.data;
  },

  async getByVideoId(videoId: string): Promise<{ video: Video }> {
    const response = await apiClient.get<{ video: Video }>(
      `/videos/video/${videoId}`,
    );
    return response.data;
  },

  async getByCreator(creatorId: string): Promise<{ videos: Video[] }> {
    const response = await apiClient.get<{ videos: Video[] }>(
      `/videos/creator/${creatorId}`,
    );
    return response.data;
  },

  getStreamUrl(videoId: string, filename: string): string {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
    return `${baseUrl}/videos/stream/${videoId}/${filename}`;
  },

  getMpdUrl(videoId: string): string {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
    return `${baseUrl}/videos/stream/${videoId}/manifest.mpd`;
  },
};

export default videoService;
