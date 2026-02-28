"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { userAuthService, userService, User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
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
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem("accessToken");
        const userType = localStorage.getItem("userType");

        if (storedToken && userType === "user") {
          setAccessToken(storedToken);
          const { user } = await userService.getProfile();
          setUser(user);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        // Clear invalid tokens
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userType");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await userAuthService.login({ email, password });

      setAccessToken(response.accessToken);

      const { user } = await userService.getProfile();
      setUser(user);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Login failed",
      };
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      try {
        await userAuthService.register({ name, email, password });
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
      await userAuthService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await userService.getProfile();
      setUser(user);
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
