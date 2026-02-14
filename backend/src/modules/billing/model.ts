import { t } from "elysia";

// Constants
export const COST_PER_REQUEST = 0.0002; // $0.0002 per request
export const SETTLEMENT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
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

// Billing status response
export interface BillingStatus {
  userId: string;
  pendingDeduction: number;
  activeSession: WatchSession | null;
  dbBalance: number;
  effectiveBalance: number; // dbBalance - pendingDeduction
}

// WebSocket message types
export interface WSBillingMessage {
  type: "start_session" | "end_session" | "get_status" | "ping";
  videoId?: string;
}

export interface WSBillingResponse {
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
