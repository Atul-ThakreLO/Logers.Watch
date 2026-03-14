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
import {
  getCreatorProof,
  verifyCreatorProof,
} from "../../services/merkle.service";
import {
  getTokenDecimals,
  getTotalWithdrawnByCreator,
} from "../../utils/blockchain";
import {
  creatorAuthMiddleware,
  CreatorAuthContext,
  CreatorJWTPayload,
} from "../../utils/middleware";
import { formatUnits, type Address } from "viem";

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
  .post(
    "/refresh",
    async ({ body, cookie, jwt, set }) => {
      try {
        const refreshTokenCookie = cookie.creatorRefreshToken as
          | { value?: string }
          | undefined;
        const refreshToken = body.refreshToken || refreshTokenCookie?.value;

        if (!refreshToken) {
          set.status = 400;
          return { error: "Refresh token is required" };
        }

        const payload = (await jwt.verify(refreshToken)) as
          | CreatorJWTPayload
          | false;

        if (!payload || payload.type !== "creator_refresh") {
          set.status = 401;
          return { error: "Invalid refresh token" };
        }

        const creator = await creatorService.findById(payload.sub);
        if (!creator) {
          set.status = 401;
          return { error: "Creator not found" };
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

        const nextRefreshPayload: CreatorJWTPayload = {
          sub: creator.id,
          email: creator.email,
          name: creator.name,
          type: "creator_refresh",
          iat: now,
          exp: now + JWT_CONFIG.refreshTokenExpiry,
        };

        const accessToken = await jwt.sign(accessPayload as any);
        const nextRefreshToken = await jwt.sign(nextRefreshPayload as any);

        cookie.creatorAccessToken.set({
          value: accessToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: JWT_CONFIG.accessTokenExpiry,
          path: "/",
        });

        cookie.creatorRefreshToken.set({
          value: nextRefreshToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: JWT_CONFIG.refreshTokenExpiry,
          path: "/api/v1/creators/refresh",
        });

        return {
          message: "Token refreshed successfully",
          accessToken,
          refreshToken: nextRefreshToken,
          expiresIn: JWT_CONFIG.accessTokenExpiry,
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
        summary: "Refresh creator access token",
        tags: ["Creator"],
      },
    },
  )
  .post(
    "/logout",
    async ({ cookie }) => {
      cookie.creatorAccessToken?.remove?.();
      cookie.creatorRefreshToken?.remove?.();
      return { message: "Logged out successfully" };
    },
    {
      detail: {
        summary: "Logout creator",
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
  )
  // Get merkle proof for claiming earnings
  .get(
    "/me/claim-proof",
    async (ctx) => {
      const { creatorId, set } = ctx as typeof ctx & CreatorAuthContext;
      if (!creatorId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      // Get creator's EOA address
      const creator = await creatorService.getById(creatorId);
      if (!creator) {
        set.status = 404;
        return { error: "Creator not found" };
      }

      if (!creator.eoaAddress) {
        set.status = 400;
        return {
          error: "EOA address not set. Please set your wallet address first.",
        };
      }

      // Get merkle proof
      const proofData = await getCreatorProof(creator.eoaAddress);
      if (!proofData) {
        set.status = 404;
        return {
          error: "No proof found. Wait for the next merkle tree update.",
        };
      }

      const tokenDecimals = await getTokenDecimals();
      const totalEarningsRaw = BigInt(proofData.totalEarnings);
      const withdrawnRaw = await getTotalWithdrawnByCreator(
        creator.eoaAddress as Address,
      );
      const claimableRaw =
        totalEarningsRaw > withdrawnRaw
          ? totalEarningsRaw - withdrawnRaw
          : BigInt(0);

      return {
        success: true,
        data: {
          proof: proofData.proof,
          totalEarnings: proofData.totalEarnings,
          totalEarningsFormatted: formatUnits(totalEarningsRaw, tokenDecimals),
          claimable: claimableRaw.toString(),
          claimableFormatted: formatUnits(claimableRaw, tokenDecimals),
          tokenDecimals,
          root: proofData.root,
          creatorAddress: creator.eoaAddress,
        },
      };
    },
    {
      detail: {
        summary: "Get merkle proof for claiming",
        description: "Get the merkle proof needed to claim earnings on-chain",
        tags: ["Creator", "Earnings"],
      },
    },
  )
  // Verify creator's claim proof
  .get(
    "/me/verify-proof",
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

      if (!creator.eoaAddress) {
        set.status = 400;
        return { error: "EOA address not set" };
      }

      const isValid = await verifyCreatorProof(creator.eoaAddress);

      return {
        success: true,
        data: {
          address: creator.eoaAddress,
          isValid,
        },
      };
    },
    {
      detail: {
        summary: "Verify claim proof",
        description: "Verify that the creator's merkle proof is valid",
        tags: ["Creator", "Earnings"],
      },
    },
  );
