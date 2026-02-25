import apiClient from "./client";

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  balance: number;
  lastRechargeAmount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Creator {
  id: string;
  name: string;
  email: string;
  company?: string;
  watchTime: number;
  amountEarned: number;
  eoaAddress?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserRegisterData {
  name: string;
  email: string;
  password: string;
}

export interface CreatorRegisterData {
  name: string;
  email: string;
  password: string;
  company?: string;
}

export interface AuthResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  user?: User;
}

export interface CreatorAuthResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  creator?: Creator;
}

// User Auth Service
export const userAuthService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      "/auth/login",
      credentials,
    );

    // Store tokens
    if (response.data.accessToken) {
      localStorage.setItem("accessToken", response.data.accessToken);
      localStorage.setItem("userType", "user");
    }
    if (response.data.refreshToken) {
      localStorage.setItem("refreshToken", response.data.refreshToken);
    }

    return response.data;
  },

  async register(
    data: UserRegisterData,
  ): Promise<{ message: string; user: User }> {
    const response = await apiClient.post<{ message: string; user: User }>(
      "/auth/register",
      data,
    );
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("userType");
    }
  },

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/auth/refresh", {
      refreshToken,
    });

    if (response.data.accessToken) {
      localStorage.setItem("accessToken", response.data.accessToken);
    }
    if (response.data.refreshToken) {
      localStorage.setItem("refreshToken", response.data.refreshToken);
    }

    return response.data;
  },
};

// Creator Auth Service
export const creatorAuthService = {
  async login(credentials: LoginCredentials): Promise<CreatorAuthResponse> {
    const response = await apiClient.post<CreatorAuthResponse>(
      "/creators/login",
      credentials,
    );

    // Store tokens with creator prefix
    if (response.data.accessToken) {
      localStorage.setItem("creatorAccessToken", response.data.accessToken);
      localStorage.setItem("userType", "creator");
    }
    if (response.data.refreshToken) {
      localStorage.setItem("creatorRefreshToken", response.data.refreshToken);
    }

    return response.data;
  },

  async register(
    data: CreatorRegisterData,
  ): Promise<{ message: string; creator: Creator }> {
    const response = await apiClient.post<{
      message: string;
      creator: Creator;
    }>("/creators/register", data);
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post("/creators/logout");
    } finally {
      localStorage.removeItem("creatorAccessToken");
      localStorage.removeItem("creatorRefreshToken");
      localStorage.removeItem("userType");
    }
  },
};

export default {
  user: userAuthService,
  creator: creatorAuthService,
};
