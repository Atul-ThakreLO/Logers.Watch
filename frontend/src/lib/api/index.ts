// API Client
export { default as apiClient } from "./client";
export type { ApiResponse, PaginatedResponse } from "./client";

// Auth Services
export { userAuthService, creatorAuthService } from "./auth";
export type {
  User,
  Creator,
  LoginCredentials,
  UserRegisterData,
  CreatorRegisterData,
  AuthResponse,
  CreatorAuthResponse,
} from "./auth";

// User Service
export { userService } from "./user";
export type { UpdateUserData } from "./user";

// Creator Service
export { creatorService } from "./creator";
export type {
  Video,
  CreatorWithVideos,
  UpdateCreatorData,
  CreateVideoData,
  UpdateVideoData,
} from "./creator";

// Billing Service
export { billingService } from "./billing";
export type { BillingStatus, RechargeData, SettlementResult } from "./billing";

// Video Service
export { videoService } from "./video";
export type { VideoListParams } from "./video";

// Convenience object with all services
const api = {
  auth: {
    user: () => import("./auth").then((m) => m.userAuthService),
    creator: () => import("./auth").then((m) => m.creatorAuthService),
  },
  user: () => import("./user").then((m) => m.userService),
  creator: () => import("./creator").then((m) => m.creatorService),
  billing: () => import("./billing").then((m) => m.billingService),
  video: () => import("./video").then((m) => m.videoService),
};

export default api;
