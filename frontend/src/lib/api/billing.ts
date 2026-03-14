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

export interface SyncBalanceResponse {
  success: boolean;
  balance: number;
  onChainBalance: string;
  message: string;
}

export interface SetWalletResponse {
  success: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    eoaAddress: string;
    balance: number;
  };
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

  /**
   * Set user's wallet address for on-chain deposits
   */
  async setWalletAddress(eoaAddress: string): Promise<SetWalletResponse> {
    const response = await apiClient.patch<SetWalletResponse>(
      "/billing/wallet",
      { eoaAddress },
    );
    return response.data;
  },

  /**
   * Sync balance from on-chain deposit
   * Call this after a successful deposit transaction
   */
  async syncBalance(): Promise<SyncBalanceResponse> {
    const response = await apiClient.post<SyncBalanceResponse>("/billing/sync");
    return response.data;
  },
};

export default billingService;
