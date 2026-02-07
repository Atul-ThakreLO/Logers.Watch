import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { authService, authMiddleware } from "./service";
import { JWT_CONFIG } from "../../utils/jwt";
import { LoginSchema, RegisterSchema } from "./model";

export const authController = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .use(cookie())
  .post(
    "/register",
    async ({ body, set }) => {
      try {
        const user = await authService.register(body);
        set.status = 201;
        return {
          message: "User registered successfully",
          user,
        };
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : "Registration failed",
        };
      }
    },
    {
      body: RegisterSchema,
      detail: {
        summary: "Register a new user",
        tags: ["Auth"],
      },
    },
  )
  .post(
    "/login",
    async ({ body, jwt, cookie, set }) => {
      try {
        const tokens = await authService.login(body, jwt.sign);

        // Set cookies for web clients
        cookie.accessToken.set({
          value: tokens.accessToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: JWT_CONFIG.accessTokenExpiry,
          path: "/",
        });

        cookie.refreshToken.set({
          value: tokens.refreshToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: JWT_CONFIG.refreshTokenExpiry,
          path: "/auth/refresh",
        });

        return {
          message: "Login successful",
          ...tokens,
        };
      } catch (error) {
        set.status = 401;
        return {
          error: error instanceof Error ? error.message : "Login failed",
        };
      }
    },
    {
      body: LoginSchema,
      detail: {
        summary: "Login user",
        tags: ["Auth"],
      },
    },
  )
  .post(
    "/refresh",
    async ({ body, cookie, jwt, set }) => {
      try {
        // Get refresh token from body or cookie
        const refreshTokenCookie = cookie.refreshToken as
          | { value?: string }
          | undefined;
        const refreshToken = body.refreshToken || refreshTokenCookie?.value;

        if (!refreshToken) {
          set.status = 400;
          return { error: "Refresh token is required" };
        }

        const tokens = await authService.refreshAccessToken(
          refreshToken,
          jwt.verify as any,
          jwt.sign,
        );

        // Update cookies
        cookie.accessToken.set({
          value: tokens.accessToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: JWT_CONFIG.accessTokenExpiry,
          path: "/",
        });

        cookie.refreshToken.set({
          value: tokens.refreshToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: JWT_CONFIG.refreshTokenExpiry,
          path: "/auth/refresh",
        });

        return {
          message: "Token refreshed successfully",
          ...tokens,
        };
      } catch (error) {
        set.status = 401;
        return {
          error:
            error instanceof Error ? error.message : "Token refresh failed",
        };
      }
    },
    {
      body: t.Object({
        refreshToken: t.Optional(t.String()),
      }),
      detail: {
        summary: "Refresh access token",
        tags: ["Auth"],
      },
    },
  )
  .post(
    "/logout",
    async ({ body, cookie, set }) => {
      try {
        const refreshTokenCookie = cookie.refreshToken as
          | { value?: string }
          | undefined;
        const refreshToken = body.refreshToken || refreshTokenCookie?.value;

        if (refreshToken) {
          await authService.logout(refreshToken);
        }

        // Clear cookies
        cookie.accessToken?.remove?.();
        cookie.refreshToken?.remove?.();

        return { message: "Logged out successfully" };
      } catch (error) {
        set.status = 500;
        return {
          error: error instanceof Error ? error.message : "Logout failed",
        };
      }
    },
    {
      body: t.Object({
        refreshToken: t.Optional(t.String()),
      }),
      detail: {
        summary: "Logout user",
        tags: ["Auth"],
      },
    },
  )
  // Protected route - requires authentication
  .use(authMiddleware)
  .post(
    "/revoke-all",
    async (ctx) => {
      const { userId, set } = ctx as typeof ctx & { userId: string | null };
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      await authService.revokeAllTokens(userId);
      return { message: "All tokens revoked successfully" };
    },
    {
      detail: {
        summary: "Revoke all refresh tokens for current user",
        tags: ["Auth"],
      },
    },
  )
  // Generate stream token for DASH streaming (protected)
  .post(
    "/stream-token",
    async (ctx) => {
      const { body, userId, jwt, set } = ctx as typeof ctx & {
        userId: string | null;
      };
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const token = await authService.generateStreamToken(
        userId,
        body.videoId,
        jwt.sign,
        body.expirySeconds,
      );

      return {
        token,
        expiresIn: body.expirySeconds || 3600,
      };
    },
    {
      body: t.Object({
        videoId: t.String(),
        expirySeconds: t.Optional(t.Number({ minimum: 60, maximum: 86400 })),
      }),
      detail: {
        summary: "Generate signed URL token for video streaming",
        description:
          "Generate a JWT token that can be used as a query parameter for DASH streaming signed URLs",
        tags: ["Auth", "Streaming"],
      },
    },
  );
