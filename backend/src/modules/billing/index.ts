import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { billingService } from "./service";
import { JWT_CONFIG } from "../../utils/jwt";
import { HeartbeatSchema, StartSessionSchema, EndSessionSchema } from "./model";

// JWT Payload for user
interface UserJWTPayload {
  sub: string;
  email: string;
  name: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

// Type for authenticated user context
type UserAuthContext = {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
};

// User auth middleware for billing routes
const userAuthMiddleware = new Elysia({ name: "billing-user-auth" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .use(cookie())
  .derive(async ({ jwt, cookie, request }): Promise<UserAuthContext> => {
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
  });

export const billingController = new Elysia({ prefix: "/billing" })
  .use(userAuthMiddleware)
  // Get billing status
  .get(
    "/status",
    async (ctx) => {
      const { userId, set } = ctx as typeof ctx & UserAuthContext;

      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const status = await billingService.getBillingStatus(userId);
      if (!status) {
        set.status = 404;
        return { error: "User not found" };
      }

      return { status };
    },
    {
      detail: {
        summary: "Get billing status including pending deductions",
        tags: ["Billing"],
      },
    },
  )
  // Start a watch session
  .post(
    "/session/start",
    async (ctx) => {
      const { body, userId, set } = ctx as typeof ctx & UserAuthContext;

      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const result = await billingService.startSession(userId, body.videoId);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return {
        success: true,
        session: result.session,
      };
    },
    {
      body: StartSessionSchema,
      detail: {
        summary: "Start a new watch session",
        tags: ["Billing"],
      },
    },
  )
  // Send heartbeat
  .post(
    "/session/heartbeat",
    async (ctx) => {
      const { body, userId, set } = ctx as typeof ctx & UserAuthContext;

      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const result = await billingService.updateHeartbeat(
        userId,
        body.videoId,
        body.currentTime,
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      // If we should settle, do it now
      if (result.shouldSettle && result.session) {
        const settlementResult = await billingService.settleToDatabase(
          userId,
          result.session.creatorId,
        );
        console.log(
          `[Billing] Periodic settlement for user ${userId}:`,
          settlementResult,
        );
      }

      // Get updated billing status
      const status = await billingService.getBillingStatus(userId);

      return {
        success: true,
        sessionActive: true,
        pendingDeduction: status?.pendingDeduction || 0,
        effectiveBalance: status?.effectiveBalance || 0,
      };
    },
    {
      body: HeartbeatSchema,
      detail: {
        summary: "Send heartbeat to keep session alive",
        tags: ["Billing"],
      },
    },
  )
  // End watch session (called on video stop/close)
  .post(
    "/session/end",
    async (ctx) => {
      const { body, userId, set } = ctx as typeof ctx & UserAuthContext;

      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const result = await billingService.endSession(userId);

      return {
        success: true,
        settled: result !== null,
        settlement: result,
      };
    },
    {
      body: EndSessionSchema,
      detail: {
        summary: "End watch session and settle to database",
        tags: ["Billing"],
      },
    },
  )
  // Force settlement (for testing/admin)
  .post(
    "/settle",
    async (ctx) => {
      const { userId, set } = ctx as typeof ctx & UserAuthContext;

      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const status = await billingService.getBillingStatus(userId);
      if (!status || !status.activeSession) {
        set.status = 400;
        return { error: "No active session to settle" };
      }

      const result = await billingService.settleToDatabase(
        userId,
        status.activeSession.creatorId,
      );

      return {
        success: result.success,
        settlement: result,
      };
    },
    {
      detail: {
        summary: "Force settlement to database",
        tags: ["Billing"],
      },
    },
  );
