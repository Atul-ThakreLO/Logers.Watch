/**
 * Admin Controller
 *
 * Admin-only endpoints (no merkle routes - handled by cron)
 */

import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { JWT_CONFIG } from "../../utils/jwt";
import { triggerMerkleUpdate } from "../../utils/cron";
import {
  getMerkleHistory,
  getActiveMerkleTree,
} from "../../services/merkle.service";

// Admin JWT payload type
interface AdminJWTPayload {
  sub: string;
  role: string;
  type: "admin_access";
  iat?: number;
  exp?: number;
}

/**
 * Check if request has valid admin authentication
 */
async function checkAdminAuth(
  request: Request,
  jwtVerify: (token: string) => Promise<AdminJWTPayload | false>,
): Promise<{ isValid: boolean; adminId?: string }> {
  // Check for admin API key first (for cron jobs / internal calls)
  const apiKey = request.headers.get("x-admin-api-key");
  if (apiKey && apiKey === process.env.ADMIN_API_KEY) {
    return { isValid: true, adminId: "api-key-admin" };
  }

  // Check for JWT token
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { isValid: false };
  }

  const token = authHeader.slice(7);

  try {
    const payload = await jwtVerify(token);
    if (
      !payload ||
      payload.type !== "admin_access" ||
      payload.role !== "admin"
    ) {
      return { isValid: false };
    }
    return { isValid: true, adminId: payload.sub };
  } catch {
    return { isValid: false };
  }
}

/**
 * Return unauthorized response
 */
function unauthorizedResponse() {
  return new Response(
    JSON.stringify({ error: "Unauthorized - Admin access required" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

export const adminController = new Elysia({ prefix: "/admin" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )

  // Health check (no auth required)
  .get("/health", () => ({
    status: "ok",
    service: "admin",
    timestamp: new Date().toISOString(),
  }))

  // Manually trigger merkle update (admin only)
  .post(
    "/merkle/trigger",
    async ({ jwt, request }) => {
      const auth = await checkAdminAuth(
        request,
        jwt.verify as (token: string) => Promise<AdminJWTPayload | false>,
      );
      if (!auth.isValid) return unauthorizedResponse();

      const result = await triggerMerkleUpdate();

      if (!result.success) {
        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      return {
        success: true,
        data: {
          root: result.root,
          transactionHash: result.transactionHash,
          creatorsProcessed: result.creatorsProcessed,
          totalEarnings: result.totalEarnings,
        },
      };
    },
    {
      detail: {
        summary: "Trigger Merkle Update",
        description:
          "Manually trigger a merkle tree update. Requires admin auth.",
        tags: ["Admin"],
      },
    },
  )

  // Get merkle update history (admin only)
  .get(
    "/merkle/history",
    async ({ jwt, request, query }) => {
      const auth = await checkAdminAuth(
        request,
        jwt.verify as (token: string) => Promise<AdminJWTPayload | false>,
      );
      if (!auth.isValid) return unauthorizedResponse();

      const limit = query.limit ? parseInt(query.limit, 10) : 10;
      const history = await getMerkleHistory(limit);

      return {
        success: true,
        data: history,
      };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
      detail: {
        summary: "Get Merkle History",
        description: "Get history of merkle tree updates.",
        tags: ["Admin"],
      },
    },
  )

  // Get active merkle tree info (admin only)
  .get(
    "/merkle/active",
    async ({ jwt, request }) => {
      const auth = await checkAdminAuth(
        request,
        jwt.verify as (token: string) => Promise<AdminJWTPayload | false>,
      );
      if (!auth.isValid) return unauthorizedResponse();

      const tree = await getActiveMerkleTree();

      if (!tree) {
        return new Response(
          JSON.stringify({ success: false, error: "No active merkle tree" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      return {
        success: true,
        data: {
          id: tree.id,
          root: tree.root,
          transactionHash: tree.transactionHash,
          creatorsCount: tree.creatorsCount,
          totalEarnings: tree.totalEarnings,
          createdAt: tree.createdAt,
        },
      };
    },
    {
      detail: {
        summary: "Get Active Merkle Tree",
        description: "Get information about the currently active merkle tree.",
        tags: ["Admin"],
      },
    },
  );
