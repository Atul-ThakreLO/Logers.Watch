/**
 * useLogersWatch Hook
 *
 * Custom hook for interacting with the LogersWatch smart contract
 * Handles deposits (with/without permit), claims, and balance queries
 */

"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSignTypedData,
  usePublicClient,
} from "wagmi";
import { parseUnits, formatUnits, type Address, type Hex } from "viem";
import {
  LOGERS_WATCH_ABI,
  LOGERS_WATCH_ADDRESS,
  SUPPORTED_TOKEN_ADDRESS,
  ERC20_ABI,
  PERMIT_TYPES,
} from "@/lib/contracts/logersWatch";

export interface DepositResult {
  success: boolean;
  hash?: Address;
  error?: string;
}

export interface ClaimResult {
  success: boolean;
  hash?: Address;
  error?: string;
}

export function useLogersWatch() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // Write contract hooks
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  // Read user's deposited balance on contract
  const { data: depositedBalance, refetch: refetchDepositedBalance } =
    useReadContract({
      address: LOGERS_WATCH_ADDRESS,
      abi: LOGERS_WATCH_ABI,
      functionName: "getTotaldepositedByUser",
      args: address ? [address] : undefined,
      query: { enabled: !!address },
    });

  // Read creator's withdrawn amount
  const { data: creatorWithdrawn, refetch: refetchCreatorWithdrawn } =
    useReadContract({
      address: LOGERS_WATCH_ADDRESS,
      abi: LOGERS_WATCH_ABI,
      functionName: "getTotalWithdrawnByCreator",
      args: address ? [address] : undefined,
      query: { enabled: !!address },
    });

  // Read platform fee
  const { data: platformFee } = useReadContract({
    address: LOGERS_WATCH_ADDRESS,
    abi: LOGERS_WATCH_ABI,
    functionName: "getPlatformFee",
  });

  // Read token balance
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: SUPPORTED_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read token decimals
  const { data: tokenDecimals } = useReadContract({
    address: SUPPORTED_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
  });

  // Read token symbol
  const { data: tokenSymbol } = useReadContract({
    address: SUPPORTED_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "symbol",
  });

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: SUPPORTED_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, LOGERS_WATCH_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  /**
   * Deposit with EIP-2612 Permit (gasless approval)
   */
  const depositWithPermit = useCallback(
    async (amount: string): Promise<DepositResult> => {
      if (!address || !publicClient) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsProcessing(true);
      try {
        const decimals = tokenDecimals || 18;
        const value = parseUnits(amount, decimals);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

        // Get nonce for permit
        const nonce = await publicClient.readContract({
          address: SUPPORTED_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "nonces",
          args: [address],
        });

        // Get token name for domain
        const tokenName = await publicClient.readContract({
          address: SUPPORTED_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "name",
        });

        // Get chain ID
        const chainId = await publicClient.getChainId();

        // Sign permit
        const signature = await signTypedDataAsync({
          domain: {
            name: tokenName as string,
            version: "1",
            chainId: chainId,
            verifyingContract: SUPPORTED_TOKEN_ADDRESS,
          },
          types: PERMIT_TYPES,
          primaryType: "Permit",
          message: {
            owner: address,
            spender: LOGERS_WATCH_ADDRESS,
            value: value,
            nonce: nonce as bigint,
            deadline: deadline,
          },
        });

        // Parse signature
        const r = signature.slice(0, 66) as Hex;
        const s = ("0x" + signature.slice(66, 130)) as Hex;
        const v = parseInt(signature.slice(130, 132), 16);

        // Call deposit with permit
        const hash = await writeContractAsync({
          address: LOGERS_WATCH_ADDRESS,
          abi: LOGERS_WATCH_ABI,
          functionName: "deposit",
          args: [SUPPORTED_TOKEN_ADDRESS, value, deadline, v, r, s],
        });

        // Refetch balances
        await refetchDepositedBalance();
        await refetchTokenBalance();

        return { success: true, hash };
      } catch (error: any) {
        console.error("Deposit with permit failed:", error);
        return {
          success: false,
          error: error.shortMessage || error.message || "Transaction failed",
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [
      address,
      publicClient,
      tokenDecimals,
      signTypedDataAsync,
      writeContractAsync,
      refetchDepositedBalance,
      refetchTokenBalance,
    ],
  );

  /**
   * Approve token for contract
   */
  const approveToken = useCallback(
    async (amount: string): Promise<DepositResult> => {
      if (!address) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsProcessing(true);
      try {
        const decimals = tokenDecimals || 18;
        const value = parseUnits(amount, decimals);

        const hash = await writeContractAsync({
          address: SUPPORTED_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [LOGERS_WATCH_ADDRESS, value],
        });

        await refetchAllowance();
        return { success: true, hash };
      } catch (error: any) {
        console.error("Approval failed:", error);
        return {
          success: false,
          error: error.shortMessage || error.message || "Approval failed",
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [address, tokenDecimals, writeContractAsync, refetchAllowance],
  );

  /**
   * Deposit without permit (requires prior approval)
   */
  const depositWithoutPermit = useCallback(
    async (amount: string): Promise<DepositResult> => {
      if (!address) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsProcessing(true);
      try {
        const decimals = tokenDecimals || 18;
        const value = parseUnits(amount, decimals);

        // Check allowance
        const currentAllowance = allowance || BigInt(0);
        if (currentAllowance < value) {
          return {
            success: false,
            error: "Insufficient allowance. Please approve first.",
          };
        }

        const hash = await writeContractAsync({
          address: LOGERS_WATCH_ADDRESS,
          abi: LOGERS_WATCH_ABI,
          functionName: "depositWithoutPermit",
          args: [SUPPORTED_TOKEN_ADDRESS, value],
        });

        // Refetch balances
        await refetchDepositedBalance();
        await refetchTokenBalance();
        await refetchAllowance();

        return { success: true, hash };
      } catch (error: any) {
        console.error("Deposit failed:", error);
        return {
          success: false,
          error: error.shortMessage || error.message || "Transaction failed",
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [
      address,
      tokenDecimals,
      allowance,
      writeContractAsync,
      refetchDepositedBalance,
      refetchTokenBalance,
      refetchAllowance,
    ],
  );

  /**
   * Claim creator earnings with merkle proof
   */
  const claimEarnings = useCallback(
    async (proof: Hex[], totalEarnings: bigint): Promise<ClaimResult> => {
      if (!address) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsProcessing(true);
      try {
        const hash = await writeContractAsync({
          address: LOGERS_WATCH_ADDRESS,
          abi: LOGERS_WATCH_ABI,
          functionName: "claim",
          args: [proof, totalEarnings, SUPPORTED_TOKEN_ADDRESS],
        });

        await refetchCreatorWithdrawn();
        return { success: true, hash };
      } catch (error: any) {
        console.error("Claim failed:", error);
        return {
          success: false,
          error: error.shortMessage || error.message || "Claim failed",
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [address, writeContractAsync, refetchCreatorWithdrawn],
  );

  // Format balances for display
  const decimals = tokenDecimals || 18;
  const formattedDepositedBalance = depositedBalance
    ? formatUnits(depositedBalance as bigint, decimals)
    : "0";
  const formattedTokenBalance = tokenBalance
    ? formatUnits(tokenBalance as bigint, decimals)
    : "0";
  const formattedAllowance = allowance
    ? formatUnits(allowance as bigint, decimals)
    : "0";
  const formattedCreatorWithdrawn = creatorWithdrawn
    ? formatUnits(creatorWithdrawn as bigint, decimals)
    : "0";
  const formattedPlatformFee = platformFee
    ? ((Number(platformFee) / 1e18) * 100).toFixed(1) + "%"
    : "10%";

  return {
    // State
    isProcessing,
    address,

    // Balances (raw)
    depositedBalance,
    tokenBalance,
    allowance,
    creatorWithdrawn,
    platformFee,

    // Balances (formatted)
    formattedDepositedBalance,
    formattedTokenBalance,
    formattedAllowance,
    formattedCreatorWithdrawn,
    formattedPlatformFee,

    // Token info
    tokenDecimals,
    tokenSymbol,

    // Actions
    depositWithPermit,
    depositWithoutPermit,
    approveToken,
    claimEarnings,

    // Refetch
    refetchDepositedBalance,
    refetchTokenBalance,
    refetchAllowance,
    refetchCreatorWithdrawn,
  };
}

export default useLogersWatch;
