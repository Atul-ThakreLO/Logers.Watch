"use client";

import { useState, useEffect } from "react";
import { userService } from "@/lib/api/user";
import { billingService, BillingStatus } from "@/lib/api/billing";
import { User } from "@/lib/api/auth";
import {
  Loader2,
  Wallet,
  TrendingDown,
  Clock,
  AlertCircle,
  RefreshCw,
  Link2,
} from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";
import useLogersWatch from "@/hooks/useLogersWatch";

export default function BalancePage() {
  const { address, isConnected } = useAccount();
  const { formattedDepositedBalance, tokenSymbol } = useLogersWatch();

  const [user, setUser] = useState<User | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  // Link wallet address when connected
  useEffect(() => {
    const linkWallet = async () => {
      if (isConnected && address) {
        try {
          await billingService.setWalletAddress(address);
        } catch (err) {
          // Ignore - wallet might already be linked
          console.debug("Wallet link:", err);
        }
      }
    };
    linkWallet();
  }, [isConnected, address]);

  const fetchData = async () => {
    try {
      const [userRes, billingRes] = await Promise.all([
        userService.getProfile(),
        billingService.getStatus().catch(() => null),
      ]);
      setUser(userRes.user);
      if (billingRes) {
        setBillingStatus(billingRes.status);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load balance info");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleSync = async () => {
    if (!isConnected) {
      setSyncMessage("Please connect your wallet first");
      return;
    }
    setIsSyncing(true);
    setSyncMessage("");
    try {
      const result = await billingService.syncBalance();
      setSyncMessage(`Balance synced: ${result.balance.toFixed(2)}`);
      await fetchData(); // Refresh data after sync
    } catch (err: any) {
      setSyncMessage(err.response?.data?.error || "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border-2 border-black p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border-2 border-black p-8">
        <div className="text-center text-red-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p>{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const currentBalance = user?.balance || 0;
  const pendingDeduction = billingStatus?.pendingDeduction || 0;
  const effectiveBalance = billingStatus?.effectiveBalance ?? currentBalance;
  const hasActiveSession = billingStatus?.activeSession !== null;

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="bg-primary border-2 border-black p-8 text-white hover:shadow-[4px_4px_0_0_#000] transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white/80 mb-2">Available Balance</p>
            <h2 className="text-4xl font-bold">
              ${effectiveBalance.toFixed(2)}
            </h2>
            {pendingDeduction > 0 && (
              <p className="text-white/70 mt-2 text-sm">
                (${currentBalance.toFixed(2)} - ${pendingDeduction.toFixed(2)}{" "}
                pending)
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-white/20 border-2 border-white/40 hover:bg-white/30 transition-colors"
          >
            <RefreshCw
              className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="mt-8">
          <Link
            href="/profile/recharge"
            className="inline-block bg-white text-primary px-6 py-3 border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all"
          >
            Add Funds
          </Link>
        </div>
      </div>

      {/* Balance Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 border-2 border-green-600 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">DB Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ${currentBalance.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 border-2 border-purple-600 flex items-center justify-center">
              <Link2 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">On-Chain Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {isConnected
                  ? `${formattedDepositedBalance} ${tokenSymbol || ""}`
                  : "Connect Wallet"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 border-2 border-orange-600 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Deduction</p>
              <p className="text-2xl font-bold text-gray-900">
                ${pendingDeduction.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 border-2 border-blue-600 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Session</p>
              <p className="text-lg font-bold text-gray-900">
                {hasActiveSession ? "Watching..." : "None"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sync On-Chain Balance */}
      {isConnected && (
        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Sync Balance
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Update your database balance from your on-chain deposits
              </p>
              {syncMessage && (
                <p
                  className={`text-sm mt-2 ${syncMessage.includes("failed") || syncMessage.includes("Please") ? "text-red-600" : "text-green-600"}`}
                >
                  {syncMessage}
                </p>
              )}
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-primary text-white border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isSyncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      )}

      {/* Active Session Details */}
      {billingStatus?.activeSession && (
        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Active Watching Session
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 border-2 border-gray-200">
              <p className="text-sm text-gray-500">Requests</p>
              <p className="text-lg font-semibold text-gray-900">
                {billingStatus.activeSession.totalRequests}
              </p>
            </div>
            <div className="p-4 bg-gray-50 border-2 border-gray-200">
              <p className="text-sm text-gray-500">Started</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(
                  billingStatus.activeSession.startTime,
                ).toLocaleTimeString()}
              </p>
            </div>
            <div className="p-4 bg-gray-50 border-2 border-gray-200">
              <p className="text-sm text-gray-500">Rate</p>
              <p className="text-lg font-semibold text-gray-900">$0.001/req</p>
            </div>
          </div>
        </div>
      )}

      {/* Low Balance Warning */}
      {effectiveBalance < 1 && (
        <div className="bg-yellow-50 border-2 border-yellow-500 p-6 flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-yellow-800">
              Low Balance Warning
            </h4>
            <p className="text-yellow-700 mt-1">
              Your balance is running low. Consider adding funds to continue
              watching content without interruption.
            </p>
            <Link
              href="/profile/recharge"
              className="inline-block mt-3 text-yellow-800 font-semibold hover:underline"
            >
              Recharge Now &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
