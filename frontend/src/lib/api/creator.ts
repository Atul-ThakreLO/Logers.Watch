import axios from "axios";
import { Creator } from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

const creatorApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

creatorApiClient.interceptors.request.use(
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

creatorApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("creatorAccessToken");
      localStorage.removeItem("creatorRefreshToken");
      localStorage.removeItem("userType");

      if (typeof window !== "undefined") {
        window.location.href = "/auth/creator/login";
      }
    }
    return Promise.reject(error);
  },
);

export interface Video {
  id: string;
  videoId: string;
  mpdFileUrl: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorWithVideos extends Creator {
  videos: Video[];
}

export interface UpdateCreatorData {
  name?: string;
  company?: string;
}

export interface CreateVideoData {
  videoId: string;
  mpdFileUrl: string;
}

export interface UpdateVideoData {
  videoId?: string;
  mpdFileUrl?: string;
}

export const creatorService = {
  async getProfile(): Promise<{ creator: Creator }> {
    const response = await creatorApiClient.get<{ creator: Creator }>(
      "/creators/me",
    );
    return response.data;
  },

  async getById(id: string): Promise<{ creator: Creator }> {
    const response = await creatorApiClient.get<{ creator: Creator }>(
      `/creators/${id}`,
    );
    return response.data;
  },

  async updateProfile(data: UpdateCreatorData): Promise<{ creator: Creator }> {
    const response = await creatorApiClient.patch<{ creator: Creator }>(
      "/creators/me",
      data,
    );
    return response.data;
  },

  async updateEoaAddress(eoaAddress: string): Promise<{ creator: Creator }> {
    const response = await creatorApiClient.patch<{ creator: Creator }>(
      "/creators/me/eoa",
      { eoaAddress },
    );
    return response.data;
  },

  async deleteAccount(): Promise<{ message: string }> {
    const response = await creatorApiClient.delete<{ message: string }>(
      "/creators/me",
    );
    return response.data;
  },

  async getVideos(): Promise<{ videos: Video[] }> {
    const response = await creatorApiClient.get<{ videos: Video[] }>(
      "/creators/me/videos",
    );
    return response.data;
  },

  async createVideo(
    data: CreateVideoData,
  ): Promise<{ message: string; video: Video }> {
    const response = await creatorApiClient.post<{
      message: string;
      video: Video;
    }>("/videos", data);
    return response.data;
  },

  async updateVideo(
    id: string,
    data: UpdateVideoData,
  ): Promise<{ video: Video }> {
    const response = await creatorApiClient.patch<{ video: Video }>(
      `/videos/${id}`,
      data,
    );
    return response.data;
  },

  async deleteVideo(id: string): Promise<{ message: string }> {
    const response = await creatorApiClient.delete<{ message: string }>(
      `/videos/${id}`,
    );
    return response.data;
  },

  // Merkle claim endpoints
  async getClaimProof(): Promise<{
    success: boolean;
    data: {
      proof: string[];
      totalEarnings: string;
      root: string;
      creatorAddress: string;
    };
  }> {
    const response = await creatorApiClient.get("/creators/me/claim-proof");
    return response.data;
  },

  async verifyClaimProof(): Promise<{
    success: boolean;
    data: {
      address: string;
      isValid: boolean;
    };
  }> {
    const response = await creatorApiClient.get("/creators/me/verify-proof");
    return response.data;
  },
};

export default creatorService;
