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
import { getTokenDecimals, setMerkleRoot } from "../utils/blockchain";
import type { Address } from "viem";

function parseDecimalStringToUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid decimal number: '${value}'`);
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");
  const scale = BigInt(10) ** BigInt(decimals);
  const wholeUnits = BigInt(wholePart) * scale;

  const fractionPadded = fractionalPart
    .padEnd(decimals, "0")
    .slice(0, decimals);
  const fractionalUnits = fractionPadded ? BigInt(fractionPadded) : BigInt(0);

  return wholeUnits + fractionalUnits;
}

function parseRateUnitsPerSecond(
  name: string,
  decimals: number,
  fallbackTokensPerSecond: string,
): bigint {
  const raw = process.env[name]?.trim();
  const effective = raw || fallbackTokensPerSecond;

  try {
    return parseDecimalStringToUnits(effective, decimals);
  } catch {
    const fallback = parseDecimalStringToUnits(
      fallbackTokensPerSecond,
      decimals,
    );
    console.warn(
      `[Merkle] Invalid ${name}='${effective}'. Expected decimal token amount per second (example: 0.00005). Using ${fallbackTokensPerSecond}.`,
    );
    return fallback;
  }
}

function normalizeAddress(address: string): Address {
  return address.toLowerCase() as Address;
}

function aggregateEarningsByAddress(
  creatorsData: CreatorEarnings[],
): CreatorEarnings[] {
  const earningsByAddress = new Map<Address, bigint>();

  for (const creator of creatorsData) {
    const normalizedAddress = normalizeAddress(creator.address);
    const current = earningsByAddress.get(normalizedAddress) ?? BigInt(0);
    earningsByAddress.set(normalizedAddress, current + creator.totalEarnings);
  }

  return Array.from(earningsByAddress.entries()).map(([address, earnings]) => ({
    address,
    totalEarnings: earnings,
  }));
}

function buildProofRows(
  creatorsData: CreatorEarnings[],
  merkleTree: ReturnType<typeof buildMerkleTree>,
) {
  const proofRowsByAddress = new Map<
    string,
    { creatorAddress: string; totalEarnings: string; proof: string[] }
  >();

  for (const [index, value] of merkleTree.tree.entries()) {
    const creatorAddress = value[0].toLowerCase();
    const totalEarnings = value[1];
    proofRowsByAddress.set(creatorAddress, {
      creatorAddress,
      totalEarnings,
      proof: merkleTree.tree.getProof(index),
    });
  }

  return creatorsData.map((creator) => {
    const creatorAddress = creator.address.toLowerCase();
    const row = proofRowsByAddress.get(creatorAddress);

    if (!row) {
      throw new Error(
        `Proof not generated for creator address ${creatorAddress}`,
      );
    }

    return row;
  });
}

const DEFAULT_EARNINGS_RATE_TOKENS_PER_SECOND = "0.00005";

export interface MerkleUpdateResult {
  success: boolean;
  root?: string;
  transactionHash?: string;
  creatorsProcessed: number;
  totalEarnings: string;
  skipped?: boolean;
  error?: string;
}

let merkleUpdateInFlight: Promise<MerkleUpdateResult> | null = null;

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
 * Normalize watch time to whole seconds for deterministic payouts.
 */
function toWholeSeconds(watchTimeSeconds: number): bigint {
  return BigInt(Math.floor(watchTimeSeconds));
}

/**
 * Generate merkle tree from database data and update contract
 */
export async function generateAndUpdateMerkleRoot(): Promise<MerkleUpdateResult> {
  if (merkleUpdateInFlight) {
    console.log(
      "[Merkle] Update already in progress. Reusing current run result.",
    );
    return merkleUpdateInFlight;
  }

  merkleUpdateInFlight = generateAndUpdateMerkleRootInternal();

  try {
    return await merkleUpdateInFlight;
  } finally {
    merkleUpdateInFlight = null;
  }
}

async function generateAndUpdateMerkleRootInternal(): Promise<MerkleUpdateResult> {
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

    const tokenDecimals = await getTokenDecimals();
    const earningsRateUnitsPerSecond = parseRateUnitsPerSecond(
      "EARNINGS_RATE_PER_SECOND",
      tokenDecimals,
      DEFAULT_EARNINGS_RATE_TOKENS_PER_SECOND,
    );

    // Build earnings data for merkle tree in raw token units.
    const creatorsDataRaw: CreatorEarnings[] = [];
    let totalEarnings = BigInt(0);

    for (const creator of dbCreators) {
      if (!creator.eoaAddress) continue;

      const watchTimeSeconds = toWholeSeconds(creator.watchTime);
      const earnings = watchTimeSeconds * earningsRateUnitsPerSecond;
      totalEarnings += earnings;

      creatorsDataRaw.push({
        address: normalizeAddress(creator.eoaAddress),
        totalEarnings: earnings,
      });
    }

    const creatorsData = aggregateEarningsByAddress(creatorsDataRaw);

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

    const existingTree = await db.merkleTree.findUnique({
      where: { root: merkleTree.root },
      select: {
        id: true,
        root: true,
        transactionHash: true,
      },
    });

    const activeTree = await db.merkleTree.findFirst({
      where: { isActive: true },
      select: { id: true, root: true },
    });

    const rootUnchanged = activeTree?.root === merkleTree.root;
    const txHash = rootUnchanged
      ? (existingTree?.transactionHash ?? undefined)
      : await setMerkleRoot(merkleTree.root as `0x${string}`);

    if (rootUnchanged) {
      console.log(
        `[Merkle] Root unchanged (${merkleTree.root}). Skipping on-chain setMerkleRoot.`,
      );
    }

    const proofRows = buildProofRows(creatorsData, merkleTree);

    if (existingTree) {
      // Keep only one active root and refresh proof rows for deterministic payouts.
      await db.merkleTree.updateMany({
        where: {
          isActive: true,
          NOT: { id: existingTree.id },
        },
        data: { isActive: false },
      });

      await db.merkleTree.update({
        where: { id: existingTree.id },
        data: {
          transactionHash: txHash ?? existingTree.transactionHash,
          creatorsCount: creatorsData.length,
          totalEarnings: totalEarnings.toString(),
          isActive: true,
          proofs: {
            deleteMany: {},
            create: proofRows,
          },
        },
      });
    } else {
      await db.merkleTree.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      await db.merkleTree.create({
        data: {
          root: merkleTree.root,
          transactionHash: txHash,
          creatorsCount: creatorsData.length,
          totalEarnings: totalEarnings.toString(),
          isActive: true,
          proofs: {
            create: proofRows,
          },
        },
      });
    }

    console.log(
      `[Merkle] Tree updated - Root: ${merkleTree.root}, TX: ${txHash}`,
    );

    return {
      success: true,
      root: merkleTree.root,
      transactionHash: txHash ?? undefined,
      creatorsProcessed: creatorsData.length,
      totalEarnings: totalEarnings.toString(),
      skipped: rootUnchanged,
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
