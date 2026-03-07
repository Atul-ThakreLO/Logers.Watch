/**
 * Merkle Service
 *
 * Business logic for generating merkle trees and updating contract roots
 * Stores merkle data in PostgreSQL database
 */

import { db } from "../utils/db";
import {
  buildMerkleTree,
  verifyProof,
  type CreatorEarnings,
} from "../utils/merkle";
import { getCreatorsFromContract, setMerkleRoot } from "../utils/blockchain";
import type { Address } from "viem";

// Earnings rate per second of watch time (configurable)
const EARNINGS_RATE_PER_SECOND = BigInt(
  process.env.EARNINGS_RATE_PER_SECOND || "1",
);

export interface MerkleUpdateResult {
  success: boolean;
  root?: string;
  transactionHash?: string;
  creatorsProcessed: number;
  totalEarnings: string;
  error?: string;
}

/**
 * Get creators from database with their watch time
 */
export async function getCreatorsFromDatabase(): Promise<
  Array<{
    id: string;
    eoaAddress: string | null;
    watchTime: number;
    amountEarned: number;
  }>
> {
  return db.creator.findMany({
    select: {
      id: true,
      eoaAddress: true,
      watchTime: true,
      amountEarned: true,
    },
    where: {
      eoaAddress: {
        not: null,
      },
    },
  });
}

/**
 * Calculate total earnings for a creator based on watch time
 */
export function calculateEarnings(watchTimeSeconds: number): bigint {
  return BigInt(Math.floor(watchTimeSeconds)) * EARNINGS_RATE_PER_SECOND;
}

/**
 * Generate merkle tree from database data and update contract
 */
export async function generateAndUpdateMerkleRoot(): Promise<MerkleUpdateResult> {
  try {
    // Get creators from database
    const dbCreators = await getCreatorsFromDatabase();

    if (dbCreators.length === 0) {
      return {
        success: false,
        creatorsProcessed: 0,
        totalEarnings: "0",
        error: "No creators with EOA addresses found in database",
      };
    }

    // Build earnings data for merkle tree
    const creatorsData: CreatorEarnings[] = [];
    let totalEarnings = BigInt(0);

    for (const creator of dbCreators) {
      if (!creator.eoaAddress) continue;

      const earnings = calculateEarnings(creator.watchTime);
      totalEarnings += earnings;

      creatorsData.push({
        address: creator.eoaAddress as Address,
        totalEarnings: earnings,
      });
    }

    if (creatorsData.length === 0) {
      return {
        success: false,
        creatorsProcessed: 0,
        totalEarnings: "0",
        error: "No valid creator data to process",
      };
    }

    // Build merkle tree using OpenZeppelin library
    const merkleTree = buildMerkleTree(creatorsData);

    // Update contract with new root
    const txHash = await setMerkleRoot(merkleTree.root as `0x${string}`);

    // Deactivate previous merkle trees
    await db.merkleTree.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Store the merkle tree data in database
    const savedTree = await db.merkleTree.create({
      data: {
        root: merkleTree.root,
        transactionHash: txHash,
        creatorsCount: creatorsData.length,
        totalEarnings: totalEarnings.toString(),
        isActive: true,
        proofs: {
          create: creatorsData.map((creator) => ({
            creatorAddress: creator.address.toLowerCase(),
            totalEarnings: creator.totalEarnings.toString(),
            proof: merkleTree.proofs.get(creator.address.toLowerCase()) || [],
          })),
        },
      },
    });

    console.log(
      `[Merkle] Tree updated - Root: ${merkleTree.root}, TX: ${txHash}`,
    );

    return {
      success: true,
      root: merkleTree.root,
      transactionHash: txHash,
      creatorsProcessed: creatorsData.length,
      totalEarnings: totalEarnings.toString(),
    };
  } catch (error) {
    console.error("[Merkle] Update failed:", error);
    return {
      success: false,
      creatorsProcessed: 0,
      totalEarnings: "0",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get the active merkle tree
 */
export async function getActiveMerkleTree() {
  return db.merkleTree.findFirst({
    where: { isActive: true },
    include: { proofs: true },
  });
}

/**
 * Get proof for a specific creator from database
 */
export async function getCreatorProof(creatorAddress: string): Promise<{
  proof: string[];
  totalEarnings: string;
  root: string;
} | null> {
  const proof = await db.merkleTreeProof.findFirst({
    where: {
      creatorAddress: creatorAddress.toLowerCase(),
      merkleTree: { isActive: true },
    },
    include: {
      merkleTree: {
        select: { root: true },
      },
    },
  });

  if (!proof) return null;

  return {
    proof: proof.proof,
    totalEarnings: proof.totalEarnings,
    root: proof.merkleTree.root,
  };
}

/**
 * Verify a creator's proof against the active tree
 */
export async function verifyCreatorProof(
  creatorAddress: string,
): Promise<boolean> {
  const proofData = await getCreatorProof(creatorAddress);
  if (!proofData) return false;

  return verifyProof(
    proofData.root,
    creatorAddress,
    proofData.totalEarnings,
    proofData.proof,
  );
}

/**
 * Get merkle update history
 */
export async function getMerkleHistory(limit: number = 10) {
  return db.merkleTree.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      root: true,
      transactionHash: true,
      creatorsCount: true,
      totalEarnings: true,
      isActive: true,
      createdAt: true,
    },
  });
}
