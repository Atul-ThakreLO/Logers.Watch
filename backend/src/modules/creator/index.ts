import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { creatorService } from "./service";
import { JWT_CONFIG } from "../../utils/jwt";
import {
  CreateCreatorSchema,
  UpdateCreatorSchema,
  CreatorLoginSchema,
} from "./model";

// JWT Payload for creator
interface CreatorJWTPayload {
  sub: string;
  email: string;
  name: string;
  type: "creator_access" | "creator_refresh";
  iat?: number;
  exp?: number;
}

// Type for authenticated creator context
type CreatorAuthContext = {
  creatorId: string | null;
  creatorEmail: string | null;
  creatorName: string | null;
};

// Creator auth middleware
const creatorAuthMiddleware = new Elysia({ name: "creator-auth-middleware" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .use(cookie())
  .derive(async ({ jwt, cookie, request }): Promise<CreatorAuthContext> => {
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
  });

export const creatorController = new Elysia({ prefix: "/creators" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .use(cookie())
  // Public routes
  .post(
    "/register",
    async ({ body, set }) => {
      try {
        const creator = await creatorService.create(body);
        set.status = 201;
        return {
          message: "Creator registered successfully",
          creator,
        };
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : "Registration failed",
        };
      }
    },
    {
      body: CreateCreatorSchema,
      detail: {
        summary: "Register a new creator",
        tags: ["Creator"],
      },
    },
  )
  .post(
    "/login",
    async ({ body, jwt, cookie, set }) => {
      try {
        const creator = await creatorService.findByEmail(body.email);
        if (!creator) {
          set.status = 401;
          return { error: "Invalid email or password" };
        }

        const isValidPassword = await creatorService.verifyPassword(
          creator,
          body.password,
        );
        if (!isValidPassword) {
          set.status = 401;
          return { error: "Invalid email or password" };
        }

        const now = Math.floor(Date.now() / 1000);

        const accessPayload: CreatorJWTPayload = {
          sub: creator.id,
          email: creator.email,
          name: creator.name,
          type: "creator_access",
          iat: now,
          exp: now + JWT_CONFIG.accessTokenExpiry,
        };

        const refreshPayload: CreatorJWTPayload = {
          sub: creator.id,
          email: creator.email,
          name: creator.name,
          type: "creator_refresh",
          iat: now,
          exp: now + JWT_CONFIG.refreshTokenExpiry,
        };

        const accessToken = await jwt.sign(accessPayload as any);
        const refreshToken = await jwt.sign(refreshPayload as any);

        cookie.creatorAccessToken.set({
          value: accessToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: JWT_CONFIG.accessTokenExpiry,
          path: "/",
        });

        cookie.creatorRefreshToken.set({
          value: refreshToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: JWT_CONFIG.refreshTokenExpiry,
          path: "/api/v1/creators/refresh",
        });

        return {
          message: "Login successful",
          accessToken,
          refreshToken,
          expiresIn: JWT_CONFIG.accessTokenExpiry,
        };
      } catch (error) {
        set.status = 500;
        return {
          error: error instanceof Error ? error.message : "Login failed",
        };
      }
    },
    {
      body: CreatorLoginSchema,
      detail: {
        summary: "Login creator",
        tags: ["Creator"],
      },
    },
  )
  // Protected routes
  .use(creatorAuthMiddleware)
  .get(
    "/me",
    async (ctx) => {
      const { creatorId, set } = ctx as typeof ctx & CreatorAuthContext;
      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const creator = await creatorService.getById(creatorId);
      if (!creator) {
        set.status = 404;
        return { error: "Creator not found" };
      }

      return { creator };
    },
    {
      detail: {
        summary: "Get current creator profile",
        tags: ["Creator"],
      },
    },
  )
  .get(
    "/me/videos",
    async (ctx) => {
      const { creatorId, set } = ctx as typeof ctx & CreatorAuthContext;
      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const creator = await creatorService.getWithVideos(creatorId);
      if (!creator) {
        set.status = 404;
        return { error: "Creator not found" };
      }

      return { videos: creator.videos };
    },
    {
      detail: {
        summary: "Get creator's videos",
        tags: ["Creator"],
      },
    },
  )
  .patch(
    "/me",
    async (ctx) => {
      const { body, creatorId, set } = ctx as typeof ctx & CreatorAuthContext;
      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const creator = await creatorService.update(creatorId, body);
      if (!creator) {
        set.status = 404;
        return { error: "Creator not found" };
      }

      return { creator };
    },
    {
      body: UpdateCreatorSchema,
      detail: {
        summary: "Update current creator profile",
        tags: ["Creator"],
      },
    },
  )
  .patch(
    "/me/eoa",
    async (ctx) => {
      const { body, creatorId, set } = ctx as typeof ctx & CreatorAuthContext;
      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const creator = await creatorService.updateEoaAddress(
        creatorId,
        body.eoaAddress,
      );
      if (!creator) {
        set.status = 404;
        return { error: "Creator not found" };
      }

      return { creator };
    },
    {
      body: t.Object({
        eoaAddress: t.String(),
      }),
      detail: {
        summary: "Update creator EOA/SA address",
        tags: ["Creator"],
      },
    },
  )
  .delete(
    "/me",
    async (ctx) => {
      const { creatorId, set } = ctx as typeof ctx & CreatorAuthContext;
      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const deleted = await creatorService.delete(creatorId);
      if (!deleted) {
        set.status = 404;
        return { error: "Creator not found" };
      }

      return { message: "Creator deleted successfully" };
    },
    {
      detail: {
        summary: "Delete current creator",
        tags: ["Creator"],
      },
    },
  );
