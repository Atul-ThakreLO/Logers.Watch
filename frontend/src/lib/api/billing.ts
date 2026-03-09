import apiClient from "./client";

export interface BillingStatus {
  userId: string;
  dbBalance: number;
  pendingDeduction: number;
  effectiveBalance: number;
  activeSession: {
    userId: string;
    videoId: string;
    creatorId: string;
    startTime: number;
    lastSettlementTime: number;
    totalRequests: number;
  } | null;
}

export const billingService = {
  /**
   * Get current billing status including balance and active session
   */
  async getStatus(): Promise<{ status: BillingStatus }> {
    const response = await apiClient.get<{ status: BillingStatus }>(
      "/billing/status",
    );
    return response.data;
  },

  // NOTE: recharge() removed - now handled on-chain via LogersWatch.deposit()
  // NOTE: settle() removed - now handled on-chain via LogersWatch.claim()
};

export default billingService;
