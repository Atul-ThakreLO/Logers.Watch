import apiClient from "./client";
import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

// Separate axios client for creator video upload (needs creator token)
const creatorVideoClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes for uploads
  withCredentials: true,
});

creatorVideoClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("creatorAccessToken");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export type VideoStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Video {
  id: string;
  videoId: string;
  mpdFileUrl: string;
  creatorId: string;
  title?: string;
  status?: VideoStatus;
  duration?: number;
  segmentCount?: number;
  errorMessage?: string;
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

export interface UploadResult {
  message: string;
  video: {
    id: string;
    videoId: string;
    title?: string;
    status: VideoStatus;
  };
}

export interface VideoStatusResult {
  video: {
    id: string;
    videoId: string;
    title?: string;
    status: VideoStatus;
    duration?: number;
    segmentCount?: number;
    errorMessage?: string;
    mpdFileUrl?: string;
  };
  jobProgress?: {
    state: string;
    progress: number;
  } | null;
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

  // Creator video upload endpoints
  async uploadVideo(
    file: File,
    title?: string,
    onProgress?: (progress: number) => void,
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("video", file);
    if (title) {
      formData.append("title", title);
    }

    const response = await creatorVideoClient.post<UploadResult>(
      "/videos/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            onProgress(percentCompleted);
          }
        },
      },
    );
    return response.data;
  },

  async getVideoStatus(videoId: string): Promise<VideoStatusResult> {
    const response = await creatorVideoClient.get<VideoStatusResult>(
      `/videos/status/${videoId}`,
    );
    return response.data;
  },

  // Poll video status until complete or failed
  async pollVideoStatus(
    videoId: string,
    onStatusChange?: (status: VideoStatusResult) => void,
    intervalMs = 2000,
    maxAttempts = 300, // 10 minutes max
  ): Promise<VideoStatusResult> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          const result = await this.getVideoStatus(videoId);

          if (onStatusChange) {
            onStatusChange(result);
          }

          if (result.video.status === "COMPLETED") {
            resolve(result);
          } else if (result.video.status === "FAILED") {
            reject(
              new Error(result.video.errorMessage || "Video processing failed"),
            );
          } else if (attempts >= maxAttempts) {
            reject(new Error("Video processing timed out"));
          } else {
            setTimeout(poll, intervalMs);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  },
};

export default videoService;
