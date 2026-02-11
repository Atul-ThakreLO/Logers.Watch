import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { userService } from "../user/service";
import { prisma } from "../../utils/db";
import { JWT_CONFIG } from "../../utils/jwt";
import type {
  JWTPayload,
  LoginDTO,
  RegisterDTO,
  TokenResponse,
  StreamTokenPayload,
} from "./model";
import type { UserResponse } from "../user/model";

export class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterDTO): Promise<UserResponse> {
    return userService.create(data);
  }

  /**
   * Login user and return tokens
   */
  async login(
    data: LoginDTO,
    jwtSign: (payload: any) => Promise<string>,
  ): Promise<TokenResponse> {
    const user = await userService.findByEmail(data.email);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isValidPassword = await userService.verifyPassword(
      user,
      data.password,
    );
    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    return this.generateTokens(user.id, user.email, user.name, jwtSign);
  }

  /**
   * Generate access and refresh tokens
   */
  async generateTokens(
    userId: string,
    email: string,
    name: string,
    jwtSign: (payload: any) => Promise<string>,
  ): Promise<TokenResponse> {
    const now = Math.floor(Date.now() / 1000);

    // Access token - short lived (15 minutes)
    const accessPayload: JWTPayload = {
      sub: userId,
      email,
      name,
      type: "access",
      iat: now,
      exp: now + JWT_CONFIG.accessTokenExpiry,
    };

    // Refresh token - long lived (7 days)
    const refreshPayload: JWTPayload = {
      sub: userId,
      email,
      name,
      type: "refresh",
      iat: now,
      exp: now + JWT_CONFIG.refreshTokenExpiry,
    };

    const accessToken = await jwtSign(accessPayload);
    const refreshToken = await jwtSign(refreshPayload);

    // Store refresh token for validation/revocation
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: new Date((now + JWT_CONFIG.refreshTokenExpiry) * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_CONFIG.accessTokenExpiry,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    jwtVerify: (token: string) => Promise<JWTPayload | false>,
    jwtSign: (payload: any) => Promise<string>,
  ): Promise<TokenResponse> {
    // Verify the refresh token
    const payload = await jwtVerify(refreshToken);
    if (!payload || payload.type !== "refresh") {
      throw new Error("Invalid refresh token");
    }

    // Check if refresh token is in our store (not revoked)
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (!storedToken) {
      throw new Error("Refresh token has been revoked");
    }

    // Check if expired
    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
      throw new Error("Refresh token has expired");
    }

    // Get user
    const user = await userService.findById(payload.sub);
    if (!user) {
      throw new Error("User not found");
    }

    // Revoke old refresh token
    await prisma.refreshToken.delete({ where: { token: refreshToken } });

    // Generate new tokens
    return this.generateTokens(user.id, user.email, user.name, jwtSign);
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
    } catch {
      // Token might already be deleted, ignore
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllTokens(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Generate a signed URL token for streaming (DASH)
   * This is useful for adaptive bitrate streaming authentication
   */
  async generateStreamToken(
    userId: string,
    videoId: string,
    jwtSign: (payload: any) => Promise<string>,
    expirySeconds: number = 3600, // 1 hour default
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const streamPayload: StreamTokenPayload = {
      sub: userId,
      videoId,
      type: "stream",
      exp: now + expirySeconds,
    };

    return jwtSign(streamPayload);
  }

  /**
   * Verify stream token for signed URLs
   */
  async verifyStreamToken(
    token: string,
    videoId: string,
    jwtVerify: (token: string) => Promise<StreamTokenPayload | false>,
  ): Promise<boolean> {
    const payload = await jwtVerify(token);
    if (!payload || payload.type !== "stream") {
      return false;
    }

    // Verify video ID matches
    if (payload.videoId !== videoId) {
      return false;
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return false;
    }

    return true;
  }
}

export const authService = new AuthService();

// Auth middleware for protected routes
export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .use(cookie())
  .derive(
    async ({
      jwt,
      cookie,
      request,
    }): Promise<{
      userId: string | null;
      userEmail: string | null;
      userName: string | null;
    }> => {
      // Try to get token from Authorization header first
      const authHeader = request.headers.get("authorization");
      let token: string | undefined;

      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      } else {
        // Fallback to cookie
        const accessTokenCookie = cookie.accessToken as
          | { value?: string }
          | undefined;
        if (accessTokenCookie?.value) {
          token = accessTokenCookie.value;
        }
      }

      if (!token) {
        return { userId: null, userEmail: null, userName: null };
      }

      try {
        const payload = (await jwt.verify(token)) as JWTPayload | false;
        if (!payload || payload.type !== "access") {
          return { userId: null, userEmail: null, userName: null };
        }

        return {
          userId: payload.sub,
          userEmail: payload.email,
          userName: payload.name,
        };
      } catch {
        return { userId: null, userEmail: null, userName: null };
      }
    },
  );
