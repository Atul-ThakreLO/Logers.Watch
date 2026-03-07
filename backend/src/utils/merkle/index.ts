/**
 * Merkle Tree Utility
 *
 * Uses OpenZeppelin's merkle-tree library for compatibility with MerkleProof.sol
 */

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import type { Address } from "viem";

export interface CreatorEarnings {
  address: Address;
  totalEarnings: bigint;
}

export interface MerkleTreeResult {
  root: string;
  tree: StandardMerkleTree<[string, string]>;
  proofs: Map<string, string[]>;
  data: CreatorEarnings[];
}

/**
 * Build a merkle tree from creator earnings data
 * Uses OpenZeppelin's StandardMerkleTree for Solidity compatibility
 */
export function buildMerkleTree(
  creatorsData: CreatorEarnings[],
): MerkleTreeResult {
  if (creatorsData.length === 0) {
    throw new Error("Cannot build merkle tree with no data");
  }

  // Format data for OpenZeppelin merkle tree: [address, totalEarnings]
  const values: [string, string][] = creatorsData.map((c) => [
    c.address.toLowerCase(),
    c.totalEarnings.toString(),
  ]);

  // Build the tree with leaf encoding matching Solidity: abi.encode(address, uint256)
  const tree = StandardMerkleTree.of(values, ["address", "uint256"]);

  // Generate proofs for each creator
  const proofs = new Map<string, string[]>();

  for (const [i, v] of tree.entries()) {
    const address = v[0].toLowerCase();
    proofs.set(address, tree.getProof(i));
  }

  return {
    root: tree.root,
    tree,
    proofs,
    data: creatorsData,
  };
}

/**
 * Verify a merkle proof
 */
export function verifyProof(
  root: string,
  address: string,
  totalEarnings: string,
  proof: string[],
): boolean {
  try {
    return StandardMerkleTree.verify(
      root,
      ["address", "uint256"],
      [address.toLowerCase(), totalEarnings],
      proof,
    );
  } catch {
    return false;
  }
}

/**
 * Get proof for a specific address from stored proofs
 */
export function getProofForAddress(
  proofs: Map<string, string[]>,
  address: string,
): string[] | undefined {
  return proofs.get(address.toLowerCase());
}
