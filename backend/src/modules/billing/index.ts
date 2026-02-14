import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { billingService } from "./service";
import { JWT_CONFIG } from "../../utils/jwt";

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
