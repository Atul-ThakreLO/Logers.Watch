"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { creatorAuthService, creatorService, Creator } from "@/lib/api";

interface CreatorAuthContextType {
  creator: Creator | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
    company?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshCreator: () => Promise<void>;
}

const CreatorAuthContext = createContext<CreatorAuthContextType | null>(null);

export function CreatorAuthProvider({ children }: { children: ReactNode }) {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem("creatorAccessToken");
        const userType = localStorage.getItem("userType");

        if (storedToken && userType === "creator") {
          setAccessToken(storedToken);
          const { creator } = await creatorService.getProfile();
          setCreator(creator);
        }
      } catch (error) {
        console.error("Creator auth check failed:", error);
        // Clear invalid tokens
        localStorage.removeItem("creatorAccessToken");
        localStorage.removeItem("creatorRefreshToken");
        localStorage.removeItem("userType");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await creatorAuthService.login({ email, password });

      setAccessToken(response.accessToken);

      const { creator } = await creatorService.getProfile();
      setCreator(creator);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Login failed",
      };
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, company?: string) => {
      try {
        await creatorAuthService.register({ name, email, password, company });
        return { success: true };
      } catch (error: any) {
        return {
          success: false,
          error: error.response?.data?.error || "Registration failed",
        };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await creatorAuthService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setCreator(null);
      setAccessToken(null);
    }
  }, []);

  const refreshCreator = useCallback(async () => {
    try {
      const { creator } = await creatorService.getProfile();
      setCreator(creator);
    } catch (error) {
      console.error("Failed to refresh creator:", error);
    }
  }, []);

  return (
    <CreatorAuthContext.Provider
      value={{
        creator,
        accessToken,
        isLoading,
        isAuthenticated: !!creator,
        login,
        register,
        logout,
        refreshCreator,
      }}
    >
      {children}
    </CreatorAuthContext.Provider>
  );
}

export function useCreatorAuth() {
  const context = useContext(CreatorAuthContext);
  if (!context) {
    throw new Error("useCreatorAuth must be used within a CreatorAuthProvider");
  }
  return context;
}
