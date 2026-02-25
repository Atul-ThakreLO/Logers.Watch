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
} from "lucide-react";
import Link from "next/link";

export default function BalancePage() {
  const [user, setUser] = useState<User | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
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
  const pendingDeductions = billingStatus?.pendingDeductions || 0;
  const availableBalance = billingStatus?.availableBalance ?? currentBalance;
  const hasActiveSession = billingStatus?.activeSession !== null;

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg p-8 text-white">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white/80 mb-2">Available Balance</p>
            <h2 className="text-4xl font-bold">
              ${availableBalance.toFixed(2)}
            </h2>
            {pendingDeductions > 0 && (
              <p className="text-white/70 mt-2 text-sm">
                (${currentBalance.toFixed(2)} - ${pendingDeductions.toFixed(2)}{" "}
                pending)
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <RefreshCw
              className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="mt-8">
          <Link
            href="/profile/recharge"
            className="inline-block bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-white/90 transition-all"
          >
            Add Funds
          </Link>
        </div>
      </div>

      {/* Balance Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ${currentBalance.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Deductions</p>
              <p className="text-2xl font-bold text-gray-900">
                ${pendingDeductions.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
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

      {/* Active Session Details */}
      {billingStatus?.activeSession && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Active Watching Session
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Watch Time</p>
              <p className="text-lg font-semibold text-gray-900">
                {Math.floor(billingStatus.activeSession.currentWatchTime / 60)}m{" "}
                {Math.floor(billingStatus.activeSession.currentWatchTime % 60)}s
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Pending Amount</p>
              <p className="text-lg font-semibold text-gray-900">
                ${billingStatus.activeSession.pendingAmount.toFixed(4)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Started</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(
                  billingStatus.activeSession.startTime,
                ).toLocaleTimeString()}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Rate</p>
              <p className="text-lg font-semibold text-gray-900">$0.001/sec</p>
            </div>
          </div>
        </div>
      )}

      {/* Low Balance Warning */}
      {availableBalance < 1 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
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
