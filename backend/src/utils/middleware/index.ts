/**
 * Shared Auth Middlewares
 *
 * Reusable middleware for user and creator authentication
 */

import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { JWT_CONFIG } from "../jwt";

// JWT Payload types
export interface UserJWTPayload {
  sub: string;
  email: string;
  name: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

export interface CreatorJWTPayload {
  sub: string;
  email: string;
  name: string;
  type: "creator_access" | "creator_refresh";
  iat?: number;
  exp?: number;
}

// Context types
export type UserAuthContext = {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
};

export type CreatorAuthContext = {
  creatorId: string | null;
  creatorEmail: string | null;
  creatorName: string | null;
};

/**
 * User authentication middleware
 * Extracts user info from JWT token (Bearer or cookie)
 */
export const userAuthMiddleware = new Elysia({ name: "shared-user-auth" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .use(cookie())
  .derive(
    { as: "global" },
    async ({ jwt, cookie, request }): Promise<UserAuthContext> => {
      const authHeader = request.headers.get("authorization");
      let token: string | undefined;

      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      } else {
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
        const payload = (await jwt.verify(token)) as UserJWTPayload | false;
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

/**
 * Creator authentication middleware
 * Extracts creator info from JWT token (Bearer or cookie)
 */
export const creatorAuthMiddleware = new Elysia({ name: "shared-creator-auth" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .use(cookie())
  .derive(
    { as: "global" },
    async ({ jwt, cookie, request }): Promise<CreatorAuthContext> => {
      const authHeader = request.headers.get("authorization");
      let token: string | undefined;

      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      } else {
        const accessTokenCookie = cookie.creatorAccessToken as
          | { value?: string }
          | undefined;
        if (accessTokenCookie?.value) {
          token = accessTokenCookie.value;
        }
      }

      if (!token) {
        return { creatorId: null, creatorEmail: null, creatorName: null };
      }

      try {
        const payload = (await jwt.verify(token)) as CreatorJWTPayload | false;
        if (!payload || payload.type !== "creator_access") {
          return { creatorId: null, creatorEmail: null, creatorName: null };
        }

        return {
          creatorId: payload.sub,
          creatorEmail: payload.email,
          creatorName: payload.name,
        };
      } catch {
        return { creatorId: null, creatorEmail: null, creatorName: null };
      }
    },
  );
