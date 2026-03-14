"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { creatorService } from "@/lib/api/creator";
import { Creator } from "@/lib/api/auth";
import {
  Loader2,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Coins,
  Check,
  Wallet,
  BadgeCheck,
  Link2,
} from "lucide-react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import useLogersWatch from "@/hooks/useLogersWatch";
import { type Hex, formatUnits } from "viem";

interface ProofData {
  proof: string[];
  totalEarnings: string;
  totalEarningsFormatted?: string;
  claimable?: string;
  claimableFormatted?: string;
  tokenDecimals?: number;
  root: string;
  creatorAddress: string;
}

export default function CreatorEarningsPage() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
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
  const [txHash, setTxHash] = useState<Hex | undefined>();
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [isLoadingProof, setIsLoadingProof] = useState(false);
  const [proofError, setProofError] = useState("");
  const [isSavingWallet, setIsSavingWallet] = useState(false);
  const [walletSaveMessage, setWalletSaveMessage] = useState("");
  const [pendingConnectSave, setPendingConnectSave] = useState(false);

  const hasSavedWallet = !!creator?.eoaAddress;

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const fetchData = useCallback(async () => {
    try {
      const { creator } = await creatorService.getProfile();
      setCreator(creator);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load earnings data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProof = async () => {
    setIsLoadingProof(true);
    setProofError("");
    try {
      const response = await creatorService.getClaimProof();
      setProofData(response.data);
    } catch (err: any) {
      setProofError(err.response?.data?.error || "Failed to fetch claim proof");
      setProofData(null);
    } finally {
      setIsLoadingProof(false);
    }
  };

  const saveWalletAddress = useCallback(async (walletAddress: string) => {
    setIsSavingWallet(true);
    setWalletSaveMessage("");
    try {
      const { creator: updatedCreator } =
        await creatorService.updateEoaAddress(walletAddress);
      setCreator(updatedCreator);
      setWalletSaveMessage("Wallet address saved successfully.");
    } catch (err: any) {
      setWalletSaveMessage(
        err.response?.data?.error || "Failed to save wallet address",
      );
    } finally {
      setIsSavingWallet(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isConfirmed && txHash) {
      setSuccess(true);
      setProofData(null);
      setTimeout(() => {
        fetchProof();
      }, 2000);
    }
  }, [isConfirmed, txHash]);

  useEffect(() => {
    if (
      pendingConnectSave &&
      !hasSavedWallet &&
      isConnected &&
      address &&
      !isSavingWallet
    ) {
      saveWalletAddress(address);
      setPendingConnectSave(false);
    }
  }, [
    address,
    hasSavedWallet,
    isConnected,
    isSavingWallet,
    pendingConnectSave,
    saveWalletAddress,
  ]);

  const handleConnectAndSave = async () => {
    if (hasSavedWallet) return;

    if (isConnected && address) {
      await saveWalletAddress(address);
      return;
    }

    setPendingConnectSave(true);
    openConnectModal?.();
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
    } else if (result.hash) {
      setTxHash(result.hash as Hex);
    }
  };

  const getClaimableAmount = () => {
    if (!proofData) return "0";
    if (proofData.claimableFormatted !== undefined) {
      return proofData.claimableFormatted;
    }

    const decimals = proofData.tokenDecimals ?? tokenDecimals ?? 18;
    const totalEarnings = BigInt(proofData.totalEarnings);
    const withdrawn = (creatorWithdrawn as bigint) || BigInt(0);
    const claimable =
      totalEarnings > withdrawn ? totalEarnings - withdrawn : BigInt(0);
    return formatUnits(claimable, decimals);
  };

  const getTotalEarnings = () => {
    if (!proofData) return "0";
    if (proofData.totalEarningsFormatted !== undefined) {
      return proofData.totalEarningsFormatted;
    }

    const decimals = proofData.tokenDecimals ?? tokenDecimals ?? 18;
    return formatUnits(BigInt(proofData.totalEarnings), decimals);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-100">
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

  const isWalletMismatch =
    !!creator?.eoaAddress &&
    !!address &&
    address.toLowerCase() !== creator.eoaAddress.toLowerCase();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Earnings</h1>
        <p className="text-gray-400 mt-1">
          Track and claim your on-chain earnings
        </p>
      </div>

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

      {walletSaveMessage && (
        <div className="bg-gray-800 border-2 border-gray-600 p-4 text-sm text-gray-200">
          {walletSaveMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        <div className="bg-secondary p-6 text-gray-900 border-2 border-black shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center gap-3 mb-4">
            <Coins className="w-6 h-6" />
            <span className="font-medium">Claimable Amount</span>
          </div>
          <p className="text-4xl font-bold">
            {proofData ? getClaimableAmount() : "-"} {tokenSymbol || ""}
          </p>
          <p className="text-sm text-gray-700 mt-2">
            {proofData ? "Available to claim" : "Fetch proof to see amount"}
          </p>
        </div>

        <div className="bg-gray-800 p-6 border-2 border-gray-600 hover:border-blue-400 hover:shadow-[4px_4px_0_0_#60a5fa] transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-medium text-gray-300">Total Earned</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {proofData ? getTotalEarnings() : "-"} {tokenSymbol || ""}
          </p>
          <p className="text-sm text-gray-500 mt-2">From latest merkle root</p>
        </div>
      </div>

      {!hasSavedWallet && (
        <div className="bg-gray-800 p-6 border-2 border-gray-600 hover:shadow-[4px_4px_0_0_#facc15] transition-shadow">
          <h3 className="text-lg font-semibold text-white mb-3">
            Set Payout Wallet
          </h3>
          <p className="text-gray-400 mb-5">
            Add your wallet once to enable claims. Choose one option below.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleConnectAndSave}
              disabled={isSavingWallet}
              className="w-full bg-secondary text-gray-900 py-3 border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSavingWallet ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving Wallet...
                </>
              ) : (
                <>
                  <Link2 className="h-5 w-5" />
                  Connect Wallet & Save
                </>
              )}
            </button>

            <Link
              href="/creator/settings"
              className="w-full bg-gray-700 text-white py-3 border-2 border-gray-600 font-semibold hover:bg-gray-600 hover:shadow-[2px_2px_0_0_#facc15] transition-all flex items-center justify-center gap-2"
            >
              <Wallet className="h-5 w-5" />
              Save Wallet Address Manually
            </Link>
          </div>
        </div>
      )}

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

        {!!creator?.eoaAddress && (
          <div className="p-4 bg-gray-900 border-2 border-gray-700 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Registered Address</span>
              <span className="text-white font-mono text-sm">
                {creator.eoaAddress.slice(0, 6)}...
                {creator.eoaAddress.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-gray-400">Connected Wallet</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-sm">
                  {isConnected && address
                    ? `${address.slice(0, 6)}...${address.slice(-4)}`
                    : "Not connected"}
                </span>
                {isConnected && address && !isWalletMismatch && (
                  <BadgeCheck className="w-4 h-4 text-green-400" />
                )}
              </div>
            </div>
          </div>
        )}

        {hasSavedWallet && !isConnected && (
          <div className="mb-6 p-4 bg-yellow-900/50 border-2 border-yellow-500 text-yellow-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            Connect your registered wallet to sign the claim transaction.
          </div>
        )}

        {isWalletMismatch && (
          <div className="mb-6 p-4 bg-yellow-900/50 border-2 border-yellow-500 text-yellow-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            Connected wallet does not match your registered payout address.
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={fetchProof}
            disabled={isLoadingProof || !hasSavedWallet}
            className="w-full bg-gray-700 text-white py-3 border-2 border-gray-600 font-medium hover:bg-gray-600 hover:shadow-[2px_2px_0_0_#facc15] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoadingProof ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Fetching Proof...
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

          {proofError && <p className="text-red-400 text-sm">{proofError}</p>}

          {proofData && (
            <div className="p-3 bg-gray-900 border-2 border-gray-700 text-sm">
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

          <button
            onClick={handleClaim}
            disabled={
              !hasSavedWallet ||
              !proofData ||
              !isConnected ||
              isWalletMismatch ||
              isProcessing ||
              isConfirming ||
              parseFloat(getClaimableAmount()) <= 0
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
                Claim {proofData ? getClaimableAmount() : "-"}{" "}
                {tokenSymbol || ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
