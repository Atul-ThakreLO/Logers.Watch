"use client";

import { useState, useEffect } from "react";
import { creatorService } from "@/lib/api/creator";
import { Creator } from "@/lib/api/auth";
import {
  Loader2,
  DollarSign,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Wallet,
} from "lucide-react";

interface Transaction {
  id: string;
  type: "earning" | "withdrawal";
  amount: number;
  date: string;
  description: string;
}

export default function CreatorEarningsPage() {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Mock transactions
  const transactions: Transaction[] = [
    {
      id: "1",
      type: "earning",
      amount: 12.5,
      date: "2026-02-25",
      description: "Video watch earnings",
    },
    {
      id: "2",
      type: "earning",
      amount: 8.75,
      date: "2026-02-24",
      description: "Video watch earnings",
    },
    {
      id: "3",
      type: "withdrawal",
      amount: 50.0,
      date: "2026-02-20",
      description: "Withdrawal to wallet",
    },
    {
      id: "4",
      type: "earning",
      amount: 15.25,
      date: "2026-02-19",
      description: "Video watch earnings",
    },
    {
      id: "5",
      type: "earning",
      amount: 22.0,
      date: "2026-02-18",
      description: "Video watch earnings",
    },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { creator } = await creatorService.getProfile();
      setCreator(creator);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load earnings data");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 text-secondary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const availableBalance = creator?.amountEarned || 0;
  const pendingEarnings = 35.5; // Mock pending amount
  const totalWithdrawn = 150.0; // Mock withdrawn amount

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Earnings</h1>
        <p className="text-gray-400 mt-1">Track and manage your earnings</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-secondary to-yellow-500 rounded-xl p-6 text-gray-900">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-6 h-6" />
            <span className="font-medium">Available Balance</span>
          </div>
          <p className="text-4xl font-bold">${availableBalance.toFixed(2)}</p>
          <button className="mt-4 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
            Withdraw Funds
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-medium text-gray-300">Pending Earnings</span>
          </div>
          <p className="text-3xl font-bold text-white">
            ${pendingEarnings.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-2">Settles in ~24h</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <span className="font-medium text-gray-300">Total Withdrawn</span>
          </div>
          <p className="text-3xl font-bold text-white">
            ${totalWithdrawn.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-2">All time</p>
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-6">
          Earnings Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Today</p>
            <p className="text-xl font-bold text-white">$12.50</p>
            <div className="flex items-center justify-center text-green-400 text-sm mt-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>+15%</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">This Week</p>
            <p className="text-xl font-bold text-white">$85.25</p>
            <div className="flex items-center justify-center text-green-400 text-sm mt-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>+8%</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">This Month</p>
            <p className="text-xl font-bold text-white">$342.75</p>
            <div className="flex items-center justify-center text-green-400 text-sm mt-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>+22%</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">All Time</p>
            <p className="text-xl font-bold text-white">
              ${(availableBalance + totalWithdrawn).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">
            Transaction History
          </h3>
          <button className="flex items-center gap-2 text-secondary hover:text-secondary/80 transition-colors text-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
        <div className="divide-y divide-gray-700">
          {transactions.map((tx) => (
            <div key={tx.id} className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    tx.type === "earning" ? "bg-green-500/20" : "bg-red-500/20"
                  }`}
                >
                  {tx.type === "earning" ? (
                    <ArrowDownRight className="w-5 h-5 text-green-400" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-white">{tx.description}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(tx.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p
                className={`font-semibold ${
                  tx.type === "earning" ? "text-green-400" : "text-red-400"
                }`}
              >
                {tx.type === "earning" ? "+" : "-"}${tx.amount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Payout Info */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Payout Information
        </h3>
        <div className="flex items-center justify-between py-4 border-b border-gray-700">
          <span className="text-gray-400">Connected Wallet</span>
          <span className="text-white font-mono text-sm">
            {creator?.eoaAddress
              ? `${creator.eoaAddress.slice(0, 6)}...${creator.eoaAddress.slice(-4)}`
              : "Not connected"}
          </span>
        </div>
        <div className="flex items-center justify-between py-4 border-b border-gray-700">
          <span className="text-gray-400">Minimum Withdrawal</span>
          <span className="text-white">$10.00</span>
        </div>
        <div className="flex items-center justify-between py-4">
          <span className="text-gray-400">Rate</span>
          <span className="text-white">$0.001/second watched</span>
        </div>
      </div>
    </div>
  );
}
