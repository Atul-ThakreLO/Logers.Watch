import apiClient from "./client";

export interface BillingStatus {
  userId: string;
  currentBalance: number;
  pendingDeductions: number;
  availableBalance: number;
  activeSession: {
    creatorId: string;
    startTime: number;
    currentWatchTime: number;
    pendingAmount: number;
  } | null;
}

export interface RechargeData {
  amount: number;
  transactionHash?: string;
}

export interface SettlementResult {
  success: boolean;
  userId: string;
  creatorId: string;
  watchTimeSeconds: number;
  amountDeducted: number;
  newUserBalance: number;
  creatorEarnings: number;
  timestamp: string;
}

export const billingService = {
  async getStatus(): Promise<{ status: BillingStatus }> {
    const response = await apiClient.get<{ status: BillingStatus }>(
      "/billing/status",
    );
    return response.data;
  },

  async settle(): Promise<{ success: boolean; settlement: SettlementResult }> {
    const response = await apiClient.post<{
      success: boolean;
      settlement: SettlementResult;
    }>("/billing/settle");
    return response.data;
  },

  async recharge(
    data: RechargeData,
  ): Promise<{ success: boolean; newBalance: number }> {
    const response = await apiClient.post<{
      success: boolean;
      newBalance: number;
    }>("/billing/recharge", data);
    return response.data;
  },

  // Get transaction history (if implemented in backend)
  async getHistory(): Promise<{ transactions: any[] }> {
    const response = await apiClient.get<{ transactions: any[] }>(
      "/billing/history",
    );
    return response.data;
  },
};

export default billingService;
