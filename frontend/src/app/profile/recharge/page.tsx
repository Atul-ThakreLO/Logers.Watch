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
  AlertCircle,
  ShieldCheck,
  Key,
} from "lucide-react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import useLogersWatch from "@/hooks/useLogersWatch";
import { type Address } from "viem";

const RECHARGE_AMOUNTS = [
  {
    value: "10",
    label: "10",
    icon: Zap,
    color: "bg-blue-100 text-blue-600",
    popular: false,
  },
  {
    value: "50",
    label: "50",
    icon: Star,
    color: "bg-green-100 text-green-600",
    popular: true,
  },
  {
    value: "100",
    label: "100",
    icon: Crown,
    color: "bg-purple-100 text-purple-600",
    popular: false,
  },
  {
    value: "500",
    label: "500",
    icon: Crown,
    color: "bg-yellow-100 text-yellow-600",
    popular: false,
  },
];

type DepositMethod = "permit" | "approval";

export default function RechargePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const {
    isProcessing,
    formattedDepositedBalance,
    formattedTokenBalance,
    formattedAllowance,
    tokenSymbol,
    depositWithPermit,
    depositWithoutPermit,
    approveToken,
    allowance,
    tokenDecimals,
  } = useLogersWatch();

  const [user, setUser] = useState<User | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<string>("50");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<Address | undefined>();
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("permit");
  const [needsApproval, setNeedsApproval] = useState(false);

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    fetchUser();
  }, []);

  // Set wallet address when connected
  useEffect(() => {
    const linkWallet = async () => {
      if (isConnected && address) {
        try {
          await billingService.setWalletAddress(address);
        } catch (err) {
          // Ignore error - wallet might already be linked
          console.debug("Wallet link:", err);
        }
      }
    };
    linkWallet();
  }, [isConnected, address]);

  useEffect(() => {
    const handleConfirmation = async () => {
      if (isConfirmed && txHash) {
        // Sync on-chain balance to DB
        try {
          await billingService.syncBalance();
        } catch (err) {
          console.error("Failed to sync balance:", err);
        }
        setSuccess(true);
        setTimeout(() => {
          router.push("/profile/balance");
        }, 2000);
      }
    };
    handleConfirmation();
  }, [isConfirmed, txHash, router]);

  // Check if approval is needed for non-permit deposit
  useEffect(() => {
    if (depositMethod === "approval" && allowance !== undefined) {
      const amount = getRechargeAmount();
      const decimals = tokenDecimals || 18;
      const requiredAmount = BigInt(
        Math.floor(parseFloat(amount) * 10 ** decimals),
      );
      setNeedsApproval((allowance as bigint) < requiredAmount);
    }
  }, [
    depositMethod,
    allowance,
    selectedAmount,
    customAmount,
    useCustom,
    tokenDecimals,
  ]);

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
      return customAmount;
    }
    return selectedAmount;
  };

  const handleApprove = async () => {
    setError("");
    const amount = getRechargeAmount();

    const result = await approveToken(amount);
    if (!result.success) {
      setError(result.error || "Approval failed");
    } else {
      setTxHash(result.hash);
    }
  };

  const handleDeposit = async () => {
    const amount = getRechargeAmount();
    if (parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setError("");

    if (!isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    let result;
    if (depositMethod === "permit") {
      result = await depositWithPermit(amount);
    } else {
      result = await depositWithoutPermit(amount);
    }

    if (!result.success) {
      setError(result.error || "Deposit failed");
    } else {
      setTxHash(result.hash);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border-2 border-black p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white border-2 border-black p-8 text-center">
        <div className="w-20 h-20 bg-green-100 border-2 border-green-600 flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Deposit Successful!
        </h2>
        <p className="text-gray-600 mb-4">
          {getRechargeAmount()} {tokenSymbol || "tokens"} has been deposited.
        </p>
        <p className="text-sm text-gray-500">Redirecting to balance page...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Balances */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 border-2 border-primary flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Contract Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {formattedDepositedBalance} {tokenSymbol || ""}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 border-2 border-green-600 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Wallet Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {formattedTokenBalance} {tokenSymbol || ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Amount Selection */}
      <div className="bg-white border-2 border-black p-8 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Select Amount ({tokenSymbol || "tokens"})
        </h3>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
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
                className={`relative p-6 border-2 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-[4px_4px_0_0_#000]"
                    : "border-gray-300 hover:border-black hover:shadow-[4px_4px_0_0_#000]"
                }`}
              >
                {amount.popular && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-white text-xs">
                    Popular
                  </span>
                )}
                <div
                  className={`w-10 h-10 ${amount.color} border-2 border-current flex items-center justify-center mx-auto mb-3`}
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
        <div className="mb-6">
          <label className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="w-4 h-4 text-primary focus:ring-primary"
            />
            <span className="text-gray-700">Enter custom amount</span>
          </label>

          {useCustom && (
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="0"
              min="1"
              step="1"
              className="w-full px-4 py-3 border-2 border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary text-lg text-gray-900"
            />
          )}
        </div>

        {/* Deposit Method Selection */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Deposit Method
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setDepositMethod("permit")}
              className={`p-4 border-2 transition-all flex items-center gap-3 ${
                depositMethod === "permit"
                  ? "border-primary bg-primary/5"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <ShieldCheck
                className={`w-5 h-5 ${depositMethod === "permit" ? "text-primary" : "text-gray-500"}`}
              />
              <div className="text-left">
                <p className="font-medium text-gray-900">
                  Permit (Recommended)
                </p>
                <p className="text-xs text-gray-500">
                  Gasless approval via signature
                </p>
              </div>
            </button>

            <button
              onClick={() => setDepositMethod("approval")}
              className={`p-4 border-2 transition-all flex items-center gap-3 ${
                depositMethod === "approval"
                  ? "border-primary bg-primary/5"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <Key
                className={`w-5 h-5 ${depositMethod === "approval" ? "text-primary" : "text-gray-500"}`}
              />
              <div className="text-left">
                <p className="font-medium text-gray-900">Approve + Deposit</p>
                <p className="text-xs text-gray-500">
                  Two transactions required
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Approval Info for non-permit method */}
        {depositMethod === "approval" && (
          <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-500">
            <p className="text-sm text-yellow-700">
              <span className="font-semibold">Current Allowance:</span>{" "}
              {formattedAllowance} {tokenSymbol || ""}
            </p>
            {needsApproval && (
              <p className="text-sm text-yellow-600 mt-1">
                You need to approve before depositing this amount.
              </p>
            )}
          </div>
        )}

        {/* Wallet Info */}
        {isConnected && (
          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-500">
            <p className="text-sm text-blue-700">
              <span className="font-semibold">Connected:</span>{" "}
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
        )}

        {/* Summary */}
        <div className="p-4 bg-gray-50 border-2 border-gray-300 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Amount to Deposit</span>
            <span className="text-2xl font-bold text-gray-900">
              {getRechargeAmount()} {tokenSymbol || ""}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {!isConnected ? (
          <div className="text-center p-8 border-2 border-dashed border-gray-300">
            <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Connect your wallet to deposit</p>
          </div>
        ) : depositMethod === "approval" && needsApproval ? (
          <div className="space-y-4">
            <button
              onClick={handleApprove}
              disabled={isProcessing || isConfirming}
              className="w-full bg-yellow-500 text-white py-4 border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing || isConfirming ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isConfirming ? "Confirming..." : "Processing..."}
                </>
              ) : (
                <>
                  <Key className="h-5 w-5" />
                  Step 1: Approve {getRechargeAmount()} {tokenSymbol || ""}
                </>
              )}
            </button>
            <button
              disabled
              className="w-full bg-gray-300 text-gray-500 py-4 border-2 border-gray-400 font-semibold cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CreditCard className="h-5 w-5" />
              Step 2: Deposit (approve first)
            </button>
          </div>
        ) : (
          <button
            onClick={handleDeposit}
            disabled={isProcessing || isConfirming}
            className="w-full bg-primary text-white py-4 border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing || isConfirming ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {isConfirming ? "Confirming..." : "Processing..."}
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Deposit {getRechargeAmount()} {tokenSymbol || ""}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
