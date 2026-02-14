import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { billingService } from "./service";
import { JWT_CONFIG } from "../../utils/jwt";
import type { WatchSession, BillingStatus } from "./model";

// Store active WebSocket connections by userId
const activeConnections = new Map<
  string,
  {
    ws: any;
    session: WatchSession | null;
    settlementTimer: ReturnType<typeof setInterval> | null;
  }
>();

// JWT Payload for user
interface UserJWTPayload {
  sub: string;
  email: string;
  name: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

// WebSocket message types
interface WSMessage {
  type: "start_session" | "end_session" | "get_status" | "ping";
  videoId?: string;
}

interface WSResponse {
  type:
    | "session_started"
    | "session_ended"
    | "status_update"
    | "balance_update"
    | "error"
    | "pong"
    | "settlement_complete";
  data?: any;
  error?: string;
}

// Settlement interval (10 minutes)
const SETTLEMENT_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Send balance update to a specific user's WebSocket connection
 */
export function sendBalanceUpdate(
  userId: string,
  pendingDeduction: number,
  effectiveBalance: number,
): void {
  const connection = activeConnections.get(userId);
  if (connection?.ws) {
    try {
      connection.ws.send(
        JSON.stringify({
          type: "balance_update",
          data: { pendingDeduction, effectiveBalance },
        } as WSResponse),
      );
    } catch (error) {
      console.error(`[WS] Error sending balance update to ${userId}:`, error);
    }
  }
}

/**
 * Check if user has active WebSocket connection
 */
export function hasActiveConnection(userId: string): boolean {
  return activeConnections.has(userId);
}

/**
 * Get number of active connections
 */
export function getActiveConnectionCount(): number {
  return activeConnections.size;
}

/**
 * Cleanup connection for a user
 */
function cleanupConnection(userId: string): void {
  const connection = activeConnections.get(userId);
  if (connection) {
    if (connection.settlementTimer) {
      clearInterval(connection.settlementTimer);
    }
    activeConnections.delete(userId);
    console.log(`[WS] Connection cleaned up for user: ${userId}`);
  }
}

/**
 * Start periodic settlement timer for a session
 */
function startSettlementTimer(userId: string, creatorId: string): void {
  const connection = activeConnections.get(userId);
  if (!connection) return;

  // Clear existing timer if any
  if (connection.settlementTimer) {
    clearInterval(connection.settlementTimer);
  }

  // Start new settlement timer
  connection.settlementTimer = setInterval(async () => {
    try {
      const result = await billingService.settleToDatabase(userId, creatorId);
      if (
        result.success &&
        (result.amountSettled > 0 || result.watchTimeSettled > 0)
      ) {
        console.log(`[WS] Periodic settlement for user ${userId}:`, {
          amountSettled: result.amountSettled,
          watchTimeSettled: result.watchTimeSettled,
        });

        // Send settlement notification
        if (connection.ws) {
          connection.ws.send(
            JSON.stringify({
              type: "settlement_complete",
              data: result,
            } as WSResponse),
          );
        }
      }
    } catch (error) {
      console.error(`[WS] Settlement error for user ${userId}:`, error);
    }
  }, SETTLEMENT_INTERVAL_MS);
}

export const billingWebSocket = new Elysia({ prefix: "/ws" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_CONFIG.secret,
    }),
  )
  .ws("/billing", {
    // Validate query params for auth token
    query: t.Object({
      token: t.String(),
    }),

    // Handle connection open
    async open(ws) {
      const token = ws.data.query.token;

      try {
        // Verify JWT token
        const payload = (await (ws.data as any).jwt.verify(token)) as
          | UserJWTPayload
          | false;

        if (!payload || payload.type !== "access") {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Invalid or expired token",
            } as WSResponse),
          );
          ws.close();
          return;
        }

        const userId = payload.sub;

        // Close existing connection if any
        if (activeConnections.has(userId)) {
          const existing = activeConnections.get(userId);
          if (existing?.ws) {
            existing.ws.send(
              JSON.stringify({
                type: "error",
                error: "Connection replaced by new session",
              } as WSResponse),
            );
            existing.ws.close();
          }
          cleanupConnection(userId);
        }

        // Store new connection
        activeConnections.set(userId, {
          ws,
          session: null,
          settlementTimer: null,
        });

        // Attach userId to ws data for later use
        (ws.data as any).userId = userId;

        console.log(`[WS] User ${userId} connected`);

        // Send initial status
        const status = await billingService.getBillingStatus(userId);
        ws.send(
          JSON.stringify({
            type: "status_update",
            data: status,
          } as WSResponse),
        );
      } catch (error) {
        console.error("[WS] Error during connection open:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Authentication failed",
          } as WSResponse),
        );
        ws.close();
      }
    },

    // Handle incoming messages
    async message(ws, message) {
      const userId = (ws.data as any).userId as string;
      if (!userId) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Not authenticated",
          } as WSResponse),
        );
        return;
      }

      try {
        const msg = typeof message === "string" ? JSON.parse(message) : message;
        const { type, videoId } = msg as WSMessage;

        const connection = activeConnections.get(userId);
        if (!connection) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Connection not found",
            } as WSResponse),
          );
          return;
        }

        switch (type) {
          case "start_session": {
            if (!videoId) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  error: "videoId is required",
                } as WSResponse),
              );
              return;
            }

            // End existing session if any
            if (connection.session) {
              await billingService.endSession(userId);
            }

            // Start new session
            const result = await billingService.startSession(userId, videoId);
            if (result.success && result.session) {
              connection.session = result.session;

              // Start periodic settlement
              startSettlementTimer(userId, result.session.creatorId);

              ws.send(
                JSON.stringify({
                  type: "session_started",
                  data: { session: result.session },
                } as WSResponse),
              );
            } else {
              ws.send(
                JSON.stringify({
                  type: "error",
                  error: result.error || "Failed to start session",
                } as WSResponse),
              );
            }
            break;
          }

          case "end_session": {
            if (connection.session) {
              const result = await billingService.endSession(userId);
              connection.session = null;

              // Stop settlement timer
              if (connection.settlementTimer) {
                clearInterval(connection.settlementTimer);
                connection.settlementTimer = null;
              }

              ws.send(
                JSON.stringify({
                  type: "session_ended",
                  data: { settlement: result },
                } as WSResponse),
              );
            } else {
              ws.send(
                JSON.stringify({
                  type: "session_ended",
                  data: { settlement: null },
                } as WSResponse),
              );
            }
            break;
          }

          case "get_status": {
            const status = await billingService.getBillingStatus(userId);
            ws.send(
              JSON.stringify({
                type: "status_update",
                data: status,
              } as WSResponse),
            );
            break;
          }

          case "ping": {
            ws.send(JSON.stringify({ type: "pong" } as WSResponse));
            break;
          }

          default:
            ws.send(
              JSON.stringify({
                type: "error",
                error: `Unknown message type: ${type}`,
              } as WSResponse),
            );
        }
      } catch (error) {
        console.error("[WS] Error processing message:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Failed to process message",
          } as WSResponse),
        );
      }
    },

    // Handle connection close
    async close(ws) {
      const userId = (ws.data as any).userId as string;
      if (!userId) return;

      console.log(`[WS] User ${userId} disconnected`);

      const connection = activeConnections.get(userId);
      if (connection?.session) {
        // End session and settle on disconnect
        try {
          const result = await billingService.endSession(userId);
          console.log(`[WS] Session ended on disconnect for user ${userId}:`, {
            amountSettled: result?.amountSettled || 0,
            watchTimeSettled: result?.watchTimeSettled || 0,
          });
        } catch (error) {
          console.error(
            `[WS] Error ending session on disconnect for ${userId}:`,
            error,
          );
        }
      }

      cleanupConnection(userId);
    },
  });
