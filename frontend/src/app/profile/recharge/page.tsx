"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { userService } from "@/lib/api/user";
import { billingService } from "@/lib/api/billing";
import { User } from "@/lib/api/auth";
import {
  Loader2,
  CreditCard,
  Wallet,
  Check,
  Zap,
  Star,
  Crown,
} from "lucide-react";
import {
  useAccount,
  useBalance,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";

const RECHARGE_AMOUNTS = [
  {
    value: 5,
    label: "$5",
    icon: Zap,
    color: "bg-blue-100 text-blue-600",
    popular: false,
  },
  {
    value: 10,
    label: "$10",
    icon: Star,
    color: "bg-green-100 text-green-600",
    popular: true,
  },
  {
    value: 25,
    label: "$25",
    icon: Crown,
    color: "bg-purple-100 text-purple-600",
    popular: false,
  },
  {
    value: 50,
    label: "$50",
    icon: Crown,
    color: "bg-yellow-100 text-yellow-600",
    popular: false,
  },
];

export default function RechargePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: walletBalance } = useBalance({ address });

  const [user, setUser] = useState<User | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Web3 transaction hooks
  const {
    data: hash,
    sendTransaction,
    isPending: isSending,
  } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (isConfirmed && hash) {
      completeRecharge(hash);
    }
  }, [isConfirmed, hash]);

  const fetchUser = async () => {
    try {
      const { user } = await userService.getProfile();
      setUser(user);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load user data");
    } finally {
      setIsLoading(false);
    }
  };

  const getRechargeAmount = () => {
    if (useCustom && customAmount) {
      return parseFloat(customAmount);
    }
    return selectedAmount;
  };

  const handleRecharge = async () => {
    const amount = getRechargeAmount();
    if (amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setError("");
    setIsProcessing(true);

    // If wallet is connected, process via blockchain
    if (isConnected && address) {
      try {
        // Convert USD amount to ETH (simplified - in production use price oracle)
        const ethAmount = amount / 2000; // Assuming 1 ETH = $2000

        sendTransaction({
          to: "0x0000000000000000000000000000000000000000", // Replace with actual treasury address
          value: parseEther(ethAmount.toString()),
        });
      } catch (err) {
        setError("Transaction failed. Please try again.");
        setIsProcessing(false);
      }
    } else {
      // Demo mode - directly update balance
      try {
        await billingService.recharge({ amount });
        setSuccess(true);
        setTimeout(() => {
          router.push("/profile/balance");
        }, 2000);
      } catch (err: any) {
        setError(err.response?.data?.error || "Recharge failed");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const completeRecharge = async (txHash: string) => {
    try {
      const amount = getRechargeAmount();
      await billingService.recharge({ amount, transactionHash: txHash });
      setSuccess(true);
      setTimeout(() => {
        router.push("/profile/balance");
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to verify transaction");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Recharge Successful!
        </h2>
        <p className="text-gray-600 mb-4">
          ${getRechargeAmount().toFixed(2)} has been added to your account.
        </p>
        <p className="text-sm text-gray-500">Redirecting to balance page...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Balance */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Current Balance</p>
            <p className="text-2xl font-bold text-gray-900">
              ${user?.balance?.toFixed(2) || "0.00"}
            </p>
          </div>
        </div>
      </div>

      {/* Amount Selection */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Select Amount
        </h3>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {RECHARGE_AMOUNTS.map((amount) => {
            const Icon = amount.icon;
            const isSelected = !useCustom && selectedAmount === amount.value;

            return (
              <button
                key={amount.value}
                onClick={() => {
                  setSelectedAmount(amount.value);
                  setUseCustom(false);
                }}
                className={`relative p-6 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {amount.popular && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-white text-xs rounded-full">
                    Popular
                  </span>
                )}
                <div
                  className={`w-10 h-10 ${amount.color} rounded-lg flex items-center justify-center mx-auto mb-3`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {amount.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Custom Amount */}
        <div className="mb-8">
          <label className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="w-4 h-4 text-primary rounded focus:ring-primary"
            />
            <span className="text-gray-700">Enter custom amount</span>
          </label>

          {useCustom && (
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                $
              </span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0.00"
                min="1"
                step="0.01"
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-lg text-gray-900"
              />
            </div>
          )}
        </div>

        {/* Wallet Info */}
        {isConnected && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <span className="font-semibold">Connected Wallet:</span>{" "}
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
            {walletBalance && (
              <p className="text-sm text-blue-600 mt-1">
                Balance:{" "}
                {(
                  Number(walletBalance.value) /
                  Math.pow(10, walletBalance.decimals)
                ).toFixed(4)}{" "}
                {walletBalance.symbol}
              </p>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="p-4 bg-gray-50 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Amount to Add</span>
            <span className="text-2xl font-bold text-gray-900">
              ${getRechargeAmount().toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
            <span className="text-gray-600">New Balance</span>
            <span className="text-lg font-semibold text-green-600">
              ${((user?.balance || 0) + getRechargeAmount()).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Recharge Button */}
        <button
          onClick={handleRecharge}
          disabled={isProcessing || isSending || isConfirming}
          className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing || isSending || isConfirming ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {isSending && "Sending transaction..."}
              {isConfirming && "Confirming..."}
              {isProcessing && !isSending && !isConfirming && "Processing..."}
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5" />
              {isConnected ? "Pay with Wallet" : "Recharge Now"}
            </>
          )}
        </button>

        {!isConnected && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Connect your wallet for blockchain payments or use demo mode
          </p>
        )}
      </div>
    </div>
  );
}
