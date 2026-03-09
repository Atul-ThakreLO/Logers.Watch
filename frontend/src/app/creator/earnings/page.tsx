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
  Check,
  AlertCircle,
  Coins,
  BadgeCheck,
} from "lucide-react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import useLogersWatch from "@/hooks/useLogersWatch";
import { type Address, type Hex, formatUnits } from "viem";

interface ProofData {
  proof: string[];
  totalEarnings: string;
  root: string;
  creatorAddress: string;
}

export default function CreatorEarningsPage() {
  const { address, isConnected } = useAccount();
  const {
    isProcessing,
    formattedCreatorWithdrawn,
    tokenSymbol,
    tokenDecimals,
    claimEarnings,
    creatorWithdrawn,
  } = useLogersWatch();

  const [creator, setCreator] = useState<Creator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimError, setClaimError] = useState("");
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<Address | undefined>();
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [isLoadingProof, setIsLoadingProof] = useState(false);
  const [proofError, setProofError] = useState("");

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isConfirmed && txHash) {
      setSuccess(true);
      setProofData(null);
      // Refetch proof after claim
      setTimeout(() => {
        fetchProof();
      }, 2000);
    }
  }, [isConfirmed, txHash]);

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

  const fetchProof = async () => {
    setIsLoadingProof(true);
    setProofError("");
    try {
      const response = await creatorService.getClaimProof();
      setProofData(response.data);
    } catch (err: any) {
      setProofError(
        err.response?.data?.error || "Failed to fetch claim proof"
      );
      setProofData(null);
    } finally {
      setIsLoadingProof(false);
    }
  };

  const handleClaim = async () => {
    if (!proofData) {
      setClaimError("No proof data available");
      return;
    }

    setClaimError("");
    setSuccess(false);

    const proof = proofData.proof as Hex[];
    const totalEarnings = BigInt(proofData.totalEarnings);

    const result = await claimEarnings(proof, totalEarnings);

    if (!result.success) {
      setClaimError(result.error || "Claim failed");
    } else {
      setTxHash(result.hash);
    }
  };

  // Calculate claimable amount
  const getClaimableAmount = () => {
    if (!proofData) return "0";
    const decimals = tokenDecimals || 18;
    const totalEarnings = BigInt(proofData.totalEarnings);
    const withdrawn = (creatorWithdrawn as bigint) || BigInt(0);
    const claimable = totalEarnings > withdrawn ? totalEarnings - withdrawn : BigInt(0);
    return formatUnits(claimable, decimals);
  };

  const getTotalEarnings = () => {
    if (!proofData) return "0";
    const decimals = tokenDecimals || 18;
    return formatUnits(BigInt(proofData.totalEarnings), decimals);
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
      <div className="bg-gray-800 p-8 text-center border-2 border-gray-600">
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Earnings</h1>
        <p className="text-gray-400 mt-1">
          Track and claim your on-chain earnings
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-900/50 border-2 border-green-500 p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-green-400 font-medium">Claim Successful!</p>
            <p className="text-green-300 text-sm">
              Your earnings have been transferred to your wallet.
            </p>
          </div>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Claimed */}
        <div className="bg-gray-800 p-6 border-2 border-gray-600 hover:border-green-400 hover:shadow-[4px_4px_0_0_#4ade80] transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-500/20 border-2 border-green-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <span className="font-medium text-gray-300">Total Claimed</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {formattedCreatorWithdrawn} {tokenSymbol || ""}
          </p>
          <p className="text-sm text-gray-500 mt-2">All time withdrawals</p>
        </div>

        {/* Pending Earnings */}
        <div className="bg-secondary p-6 text-gray-900 border-2 border-black shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center gap-3 mb-4">
            <Coins className="w-6 h-6" />
            <span className="font-medium">Claimable Amount</span>
          </div>
          <p className="text-4xl font-bold">
            {proofData ? getClaimableAmount() : "—"} {tokenSymbol || ""}
          </p>
          <p className="text-sm text-gray-700 mt-2">
            {proofData ? "Available to claim" : "Fetch proof to see amount"}
          </p>
        </div>

        {/* Total Earned (from merkle) */}
        <div className="bg-gray-800 p-6 border-2 border-gray-600 hover:border-blue-400 hover:shadow-[4px_4px_0_0_#60a5fa] transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-medium text-gray-300">Total Earned</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {proofData ? getTotalEarnings() : "—"} {tokenSymbol || ""}
          </p>
          <p className="text-sm text-gray-500 mt-2">From merkle root</p>
        </div>
      </div>

      {/* Claim Section */}
      <div className="bg-gray-800 p-6 border-2 border-gray-600 hover:shadow-[4px_4px_0_0_#facc15] transition-shadow">
        <h3 className="text-lg font-semibold text-white mb-6">
          Claim Your Earnings
        </h3>

        {claimError && (
          <div className="mb-6 p-4 bg-red-900/50 border-2 border-red-500 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {claimError}
          </div>
        )}

        {/* Wallet Connection Check */}
        {!isConnected ? (
          <div className="text-center p-8 border-2 border-dashed border-gray-600">
            <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              Connect your wallet to claim earnings
            </p>
          </div>
        ) : !creator?.eoaAddress ? (
          <div className="text-center p-8 border-2 border-dashed border-gray-600">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              Please set your wallet address in settings first
            </p>
            <a
              href="/creator/settings"
              className="text-secondary hover:underline"
            >
              Go to Settings
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connected Wallet Info */}
            <div className="p-4 bg-gray-900 border-2 border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Connected Wallet</span>
                <span className="text-white font-mono text-sm">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-400">Registered Address</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-sm">
                    {creator.eoaAddress.slice(0, 6)}...
                    {creator.eoaAddress.slice(-4)}
                  </span>
                  {address?.toLowerCase() ===
                  creator.eoaAddress.toLowerCase() ? (
                    <BadgeCheck className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Address Mismatch Warning */}
            {address?.toLowerCase() !== creator.eoaAddress.toLowerCase() && (
              <div className="p-4 bg-yellow-900/50 border-2 border-yellow-500 text-yellow-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                Connected wallet doesn't match your registered address. Please
                switch to {creator.eoaAddress.slice(0, 6)}...
                {creator.eoaAddress.slice(-4)}
              </div>
            )}

            {/* Step 1: Fetch Proof */}
            <div className="p-4 border-2 border-gray-700 bg-gray-900">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary text-gray-900 font-bold flex items-center justify-center">
                    1
                  </div>
                  <span className="font-medium text-white">
                    Fetch Merkle Proof
                  </span>
                </div>
                {proofData && (
                  <Check className="w-5 h-5 text-green-400" />
                )}
              </div>

              {proofError && (
                <p className="text-red-400 text-sm mb-4">{proofError}</p>
              )}

              <button
                onClick={fetchProof}
                disabled={isLoadingProof}
                className="w-full bg-gray-700 text-white py-3 border-2 border-gray-600 font-medium hover:bg-gray-600 hover:shadow-[2px_2px_0_0_#facc15] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoadingProof ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Fetching...
                  </>
                ) : proofData ? (
                  <>
                    <Check className="h-5 w-5" />
                    Proof Loaded
                  </>
                ) : (
                  "Fetch Proof"
                )}
              </button>

              {/* Proof Details */}
              {proofData && (
                <div className="mt-4 p-3 bg-gray-800 border border-gray-700 text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Total Earnings:</span>
                    <span className="text-white font-mono">
                      {getTotalEarnings()} {tokenSymbol || ""}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Already Claimed:</span>
                    <span className="text-white font-mono">
                      {formattedCreatorWithdrawn} {tokenSymbol || ""}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                    <span className="text-gray-400">Claimable:</span>
                    <span className="text-secondary font-mono font-bold">
                      {getClaimableAmount()} {tokenSymbol || ""}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Claim */}
            <div className="p-4 border-2 border-gray-700 bg-gray-900">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-secondary text-gray-900 font-bold flex items-center justify-center">
                  2
                </div>
                <span className="font-medium text-white">
                  Claim On-Chain
                </span>
              </div>

              <button
                onClick={handleClaim}
                disabled={
                  !proofData ||
                  isProcessing ||
                  isConfirming ||
                  parseFloat(getClaimableAmount()) <= 0 ||
                  address?.toLowerCase() !== creator.eoaAddress.toLowerCase()
                }
                className="w-full bg-secondary text-gray-900 py-3 border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing || isConfirming ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isConfirming ? "Confirming..." : "Processing..."}
                  </>
                ) : (
                  <>
                    <DollarSign className="h-5 w-5" />
                    Claim {proofData ? getClaimableAmount() : "—"}{" "}
                    {tokenSymbol || ""}
                  </>
                )}
              </button>

              {parseFloat(getClaimableAmount()) <= 0 && proofData && (
                <p className="text-gray-500 text-sm text-center mt-3">
                  No amount available to claim
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Payout Info */}
      <div className="bg-gray-800 p-6 border-2 border-gray-600">
        <h3 className="text-lg font-semibold text-white mb-4">
          Payout Information
        </h3>
        <div className="flex items-center justify-between py-4 border-b-2 border-gray-700">
          <span className="text-gray-400">Connected Wallet</span>
          <span className="text-white font-mono text-sm">
            {isConnected
              ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
              : "Not connected"}
          </span>
        </div>
        <div className="flex items-center justify-between py-4 border-b-2 border-gray-700">
          <span className="text-gray-400">Registered Address</span>
          <span className="text-white font-mono text-sm">
            {creator?.eoaAddress
              ? `${creator.eoaAddress.slice(0, 6)}...${creator.eoaAddress.slice(-4)}`
              : "Not set"}
          </span>
        </div>
        <div className="flex items-center justify-between py-4 border-b-2 border-gray-700">
          <span className="text-gray-400">Claim Method</span>
          <span className="text-white">Merkle Proof Verification</span>
        </div>
        <div className="flex items-center justify-between py-4">
          <span className="text-gray-400">Rate</span>
          <span className="text-white">$0.001/second watched</span>
        </div>
      </div>
    </div>
  );
}
