import { redis, cache, CacheKeys, prisma } from "../../utils/db";
import { videoService } from "../video/service";
import {
  COST_PER_REQUEST,
  SESSION_TTL_SECONDS,
  HEARTBEAT_TIMEOUT_MS,
  type WatchSession,
  type SettlementResult,
  type BillingStatus,
} from "./model";

export class BillingService {
  /**
   * Deduct balance for a streaming request (atomic Redis operation)
   * Returns false if user has insufficient balance
   */
  async deductForRequest(userId: string): Promise<{
    success: boolean;
    newPendingDeduction: number;
    error?: string;
  }> {
    const pendingKey = CacheKeys.userPendingDeduction(userId);

    // Atomically increment pending deduction
    const newPendingStr = await redis.incrbyfloat(pendingKey, COST_PER_REQUEST);
    const newPending = parseFloat(newPendingStr);

    // Set TTL if this is a new key
    const ttl = await redis.ttl(pendingKey);
    if (ttl === -1) {
      await redis.expire(pendingKey, SESSION_TTL_SECONDS);
    }

    // Check if user still has sufficient balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user) {
      // Revert the deduction
      await redis.incrbyfloat(pendingKey, -COST_PER_REQUEST);
      return {
        success: false,
        newPendingDeduction: newPending - COST_PER_REQUEST,
        error: "User not found",
      };
    }

    const effectiveBalance = user.balance - newPending;
    if (effectiveBalance < 0) {
      // Revert the deduction
      await redis.incrbyfloat(pendingKey, -COST_PER_REQUEST);
      return {
        success: false,
        newPendingDeduction: newPending - COST_PER_REQUEST,
        error: "Insufficient balance",
      };
    }

    return { success: true, newPendingDeduction: newPending };
  }

  /**
   * Start a watch session
   */
  async startSession(
    userId: string,
    videoId: string,
  ): Promise<{ success: boolean; session?: WatchSession; error?: string }> {
    // Get video to find creator
    const video = await videoService.findByVideoId(videoId);
    if (!video) {
      return { success: false, error: "Video not found" };
    }

    const sessionKey = CacheKeys.userWatchSession(userId);
    const heartbeatKey = CacheKeys.userLastHeartbeat(userId);
    const activeSessionsKey = CacheKeys.activeSessions();

    const now = Date.now();
    const session: WatchSession = {
      userId,
      videoId,
      creatorId: video.creatorId,
      startTime: now,
      lastSettlementTime: now,
      totalRequests: 0,
    };

    // Store session in Redis
    await cache.set(sessionKey, session, SESSION_TTL_SECONDS);

    // Update heartbeat
    await redis.set(heartbeatKey, now.toString(), "EX", SESSION_TTL_SECONDS);

    // Add to active sessions set
    await redis.sadd(activeSessionsKey, userId);

    return { success: true, session };
  }

  /**
   * Update heartbeat and optionally track watch time
   */
  async updateHeartbeat(
    userId: string,
    videoId: string,
    currentTime?: number,
  ): Promise<{
    success: boolean;
    session?: WatchSession;
    shouldSettle: boolean;
    error?: string;
  }> {
    const sessionKey = CacheKeys.userWatchSession(userId);
    const heartbeatKey = CacheKeys.userLastHeartbeat(userId);

    const session = await cache.get<WatchSession>(sessionKey);
    if (!session) {
      // Auto-start session if not exists
      const startResult = await this.startSession(userId, videoId);
      if (!startResult.success) {
        return {
          success: false,
          shouldSettle: false,
          error: startResult.error,
        };
      }
      return {
        success: true,
        session: startResult.session,
        shouldSettle: false,
      };
    }

    // Check if watching the same video
    if (session.videoId !== videoId) {
      // End current session and start new one
      await this.endSession(userId);
      const startResult = await this.startSession(userId, videoId);
      if (!startResult.success) {
        return {
          success: false,
          shouldSettle: false,
          error: startResult.error,
        };
      }
      return {
        success: true,
        session: startResult.session,
        shouldSettle: false,
      };
    }

    const now = Date.now();

    // Update heartbeat timestamp
    await redis.set(heartbeatKey, now.toString(), "EX", SESSION_TTL_SECONDS);

    // Check if we should settle (every 10 minutes)
    const timeSinceLastSettlement = now - session.lastSettlementTime;
    const shouldSettle = timeSinceLastSettlement >= 10 * 60 * 1000; // 10 minutes

    return { success: true, session, shouldSettle };
  }

  /**
   * Increment request count for a session
   */
  async incrementRequestCount(userId: string): Promise<void> {
    const sessionKey = CacheKeys.userWatchSession(userId);
    const session = await cache.get<WatchSession>(sessionKey);

    if (session) {
      session.totalRequests++;
      await cache.set(sessionKey, session, SESSION_TTL_SECONDS);
    }
  }

  /**
   * Add watch time to creator's pending watch time in Redis
   */
  async addCreatorWatchTime(creatorId: string, seconds: number): Promise<void> {
    const key = CacheKeys.creatorPendingWatchTime(creatorId);
    await redis.incrbyfloat(key, seconds);

    // Set TTL if new key
    const ttl = await redis.ttl(key);
    if (ttl === -1) {
      await redis.expire(key, SESSION_TTL_SECONDS);
    }
  }

  /**
   * End a watch session and trigger settlement
   */
  async endSession(userId: string): Promise<SettlementResult | null> {
    const sessionKey = CacheKeys.userWatchSession(userId);
    const heartbeatKey = CacheKeys.userLastHeartbeat(userId);
    const activeSessionsKey = CacheKeys.activeSessions();

    const session = await cache.get<WatchSession>(sessionKey);
    if (!session) {
      return null;
    }

    // Calculate final watch time for this session
    const now = Date.now();
    const watchTimeSeconds = (now - session.lastSettlementTime) / 1000;

    // Add watch time to creator
    if (watchTimeSeconds > 0) {
      await this.addCreatorWatchTime(session.creatorId, watchTimeSeconds);
    }

    // Settle to database
    const result = await this.settleToDatabase(userId, session.creatorId);

    // Clean up Redis keys
    await cache.del(sessionKey);
    await cache.del(heartbeatKey);
    await redis.srem(activeSessionsKey, userId);

    return result;
  }

  /**
   * Settle pending deductions and watch time to database
   */
  async settleToDatabase(
    userId: string,
    creatorId: string,
  ): Promise<SettlementResult> {
    const pendingKey = CacheKeys.userPendingDeduction(userId);
    const creatorWatchTimeKey = CacheKeys.creatorPendingWatchTime(creatorId);
    const sessionKey = CacheKeys.userWatchSession(userId);

    try {
      // Get pending amounts atomically
      const pendingDeduction = parseFloat((await redis.get(pendingKey)) || "0");
      const pendingWatchTime = parseFloat(
        (await redis.get(creatorWatchTimeKey)) || "0",
      );

      if (pendingDeduction === 0 && pendingWatchTime === 0) {
        return {
          userId,
          creatorId,
          amountSettled: 0,
          watchTimeSettled: 0,
          success: true,
        };
      }

      // Use transaction to update database
      await prisma.$transaction(async (tx) => {
        // Deduct from user balance
        if (pendingDeduction > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { balance: { decrement: pendingDeduction } },
          });
        }

        // Add watch time and earnings to creator
        if (pendingWatchTime > 0) {
          await tx.creator.update({
            where: { id: creatorId },
            data: {
              watchTime: { increment: pendingWatchTime },
              // For now, creator earns same as user pays (can adjust ratio later)
              amountEarned: { increment: pendingDeduction },
            },
          });
        }
      });

      // Clear Redis pending amounts after successful settlement
      await redis.set(pendingKey, "0", "EX", SESSION_TTL_SECONDS);
      await redis.set(creatorWatchTimeKey, "0", "EX", SESSION_TTL_SECONDS);

      // Update session's last settlement time
      const session = await cache.get<WatchSession>(sessionKey);
      if (session) {
        session.lastSettlementTime = Date.now();
        await cache.set(sessionKey, session, SESSION_TTL_SECONDS);
      }

      // Invalidate user cache
      await cache.del(CacheKeys.user(userId));
      await cache.del(CacheKeys.creator(creatorId));

      return {
        userId,
        creatorId,
        amountSettled: pendingDeduction,
        watchTimeSettled: pendingWatchTime,
        success: true,
      };
    } catch (error) {
      return {
        userId,
        creatorId,
        amountSettled: 0,
        watchTimeSettled: 0,
        success: false,
        error: error instanceof Error ? error.message : "Settlement failed",
      };
    }
  }

  /**
   * Get billing status for a user
   */
  async getBillingStatus(userId: string): Promise<BillingStatus | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user) {
      return null;
    }

    const pendingKey = CacheKeys.userPendingDeduction(userId);
    const sessionKey = CacheKeys.userWatchSession(userId);

    const pendingDeduction = parseFloat((await redis.get(pendingKey)) || "0");
    const session = await cache.get<WatchSession>(sessionKey);

    return {
      userId,
      pendingDeduction,
      activeSession: session,
      dbBalance: user.balance,
      effectiveBalance: user.balance - pendingDeduction,
    };
  }

  /**
   * Get all active sessions (for worker to check stale sessions)
   */
  async getActiveSessions(): Promise<string[]> {
    const activeSessionsKey = CacheKeys.activeSessions();
    return await redis.smembers(activeSessionsKey);
  }

  /**
   * Check if a session is stale (no heartbeat for > 2 minutes)
   */
  async isSessionStale(userId: string): Promise<boolean> {
    const heartbeatKey = CacheKeys.userLastHeartbeat(userId);
    const lastHeartbeat = await redis.get(heartbeatKey);

    if (!lastHeartbeat) {
      return true;
    }

    const lastHeartbeatTime = parseInt(lastHeartbeat, 10);
    const now = Date.now();

    return now - lastHeartbeatTime > HEARTBEAT_TIMEOUT_MS;
  }

  /**
   * Process stale sessions (called by background worker)
   */
  async processStaleSession(userId: string): Promise<SettlementResult | null> {
    const isStale = await this.isSessionStale(userId);
    if (!isStale) {
      return null;
    }

    console.log(
      `[Billing Worker] Processing stale session for user: ${userId}`,
    );
    return await this.endSession(userId);
  }
}

// Export singleton instance
export const billingService = new BillingService();
