import { t } from "elysia";

// Constants
export const COST_PER_REQUEST = 0.0002; // $0.0002 per request
export const SETTLEMENT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
export const HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes - consider session stale after this
export const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours TTL for Redis keys

// Watch session stored in Redis
export interface WatchSession {
  userId: string;
  videoId: string;
  creatorId: string;
  startTime: number; // timestamp when session started
  lastSettlementTime: number; // timestamp of last DB settlement
  totalRequests: number; // total segment requests in this session
}

// Pending billing data in Redis
export interface PendingBilling {
  userId: string;
  pendingDeduction: number; // accumulated amount to deduct
  pendingWatchTime: number; // accumulated watch time in seconds
}

// Settlement result
export interface SettlementResult {
  userId: string;
  amountSettled: number;
  watchTimeSettled: number;
  creatorId: string;
  success: boolean;
  error?: string;
}

// Heartbeat request schema
export const HeartbeatSchema = t.Object({
  videoId: t.String(),
  currentTime: t.Optional(t.Number()), // current playback position in seconds
});

// Start session request schema
export const StartSessionSchema = t.Object({
  videoId: t.String(),
});

// End session request schema
export const EndSessionSchema = t.Object({
  videoId: t.String(),
});

// Billing status response
export interface BillingStatus {
  userId: string;
  pendingDeduction: number;
  activeSession: WatchSession | null;
  dbBalance: number;
  effectiveBalance: number; // dbBalance - pendingDeduction
}

// Types for API responses
export interface HeartbeatResponse {
  success: boolean;
  sessionActive: boolean;
  pendingDeduction: number;
  effectiveBalance: number;
}

export interface SessionResponse {
  success: boolean;
  session?: WatchSession;
  error?: string;
}
