/**
 * Blockchain Service
 *
 * Handles interactions with the LogersWatch smart contract
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, mainnet, localhost } from "viem/chains";

// LogersWatch Contract ABI (only the functions we need)
export const LOGERS_WATCH_ABI = [
  {
    name: "setMerkleRoot",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "root", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "getCreators",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "addCreator",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [],
  },
  {
    name: "getTotalWithdrawnByCreator",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getPlatformFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Chain configuration
const CHAIN_MAP: Record<string, Chain> = {
  sepolia,
  mainnet,
  localhost,
};

// Get chain from environment
function getChain(): Chain {
  const chainName = process.env.CHAIN_NAME || "localhost";
  const chain = CHAIN_MAP[chainName];
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }
  return chain;
}

// Get RPC URL
function getRpcUrl(): string {
  return process.env.RPC_URL || "http://127.0.0.1:8545";
}

// Get contract address
function getContractAddress(): Address {
  const address = process.env.LOGERS_WATCH_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error(
      "LOGERS_WATCH_CONTRACT_ADDRESS environment variable not set",
    );
  }
  return address as Address;
}

// Create public client for read operations
export function createPublicClientInstance(): PublicClient {
  return createPublicClient({
    chain: getChain(),
    transport: http(getRpcUrl()),
  });
}

// Create wallet client for write operations
export function createWalletClientInstance(): WalletClient {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("ADMIN_PRIVATE_KEY environment variable not set");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return createWalletClient({
    account,
    chain: getChain(),
    transport: http(getRpcUrl()),
  });
}

/**
 * Get all creators registered on the contract
 */
export async function getCreatorsFromContract(): Promise<Address[]> {
  const client = createPublicClientInstance();
  const contractAddress = getContractAddress();

  const creators = await client.readContract({
    address: contractAddress,
    abi: LOGERS_WATCH_ABI,
    functionName: "getCreators",
  });

  return creators as Address[];
}

/**
 * Get total withdrawn amount by creator
 */
export async function getTotalWithdrawnByCreator(
  creator: Address,
): Promise<bigint> {
  const client = createPublicClientInstance();
  const contractAddress = getContractAddress();

  const withdrawn = await client.readContract({
    address: contractAddress,
    abi: LOGERS_WATCH_ABI,
    functionName: "getTotalWithdrawnByCreator",
    args: [creator],
  });

  return withdrawn as bigint;
}

/**
 * Get platform fee
 */
export async function getPlatformFee(): Promise<bigint> {
  const client = createPublicClientInstance();
  const contractAddress = getContractAddress();

  const fee = await client.readContract({
    address: contractAddress,
    abi: LOGERS_WATCH_ABI,
    functionName: "getPlatformFee",
  });

  return fee as bigint;
}

/**
 * Set merkle root on the contract
 */
export async function setMerkleRoot(
  root: `0x${string}`,
): Promise<`0x${string}`> {
  const walletClient = createWalletClientInstance();
  const publicClient = createPublicClientInstance();
  const contractAddress = getContractAddress();

  // Simulate first to check for errors
  await publicClient.simulateContract({
    address: contractAddress,
    abi: LOGERS_WATCH_ABI,
    functionName: "setMerkleRoot",
    args: [root],
    account: walletClient.account,
  });

  // Execute the transaction
  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: LOGERS_WATCH_ABI,
    functionName: "setMerkleRoot",
    args: [root],
    chain: getChain(),
    account: walletClient.account!,
  });

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}

/**
 * Add creator to contract
 */
export async function addCreatorToContract(
  creator: Address,
): Promise<`0x${string}`> {
  const walletClient = createWalletClientInstance();
  const publicClient = createPublicClientInstance();
  const contractAddress = getContractAddress();

  // Simulate first
  await publicClient.simulateContract({
    address: contractAddress,
    abi: LOGERS_WATCH_ABI,
    functionName: "addCreator",
    args: [creator],
    account: walletClient.account,
  });

  // Execute the transaction
  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: LOGERS_WATCH_ABI,
    functionName: "addCreator",
    args: [creator],
    chain: getChain(),
    account: walletClient.account!,
  });

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}
