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
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { sepolia, mainnet, localhost } from "viem/chains";
import { Wallet } from "@ethereumjs/wallet";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

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

/**
 * Load account from Foundry keystore file
 * Keystore path: ~/.foundry/keystores/<name>
 */
async function loadAccountFromKeystore(): Promise<PrivateKeyAccount> {
  const keystoreName = process.env.ADMIN_KEYSTORE_NAME;
  const password = process.env.ADMIN_KEYSTORE_PASSWORD;

  if (!keystoreName) {
    throw new Error("ADMIN_KEYSTORE_NAME environment variable not set");
  }
  if (!password) {
    throw new Error("ADMIN_KEYSTORE_PASSWORD environment variable not set");
  }

  const fullPath = resolve(homedir(), ".foundry", "keystores", keystoreName);
  const keystoreJson = readFileSync(fullPath, "utf-8");
  const keystore = JSON.parse(keystoreJson);

  // Decrypt the keystore
  const wallet = await Wallet.fromV3(keystore, password);
  const privateKey =
    `0x${wallet.getPrivateKeyString().replace("0x", "")}` as `0x${string}`;

  return privateKeyToAccount(privateKey);
}

// Create wallet client for write operations (uses keystore)
export async function createWalletClientInstance(): Promise<WalletClient> {
  const account = await loadAccountFromKeystore();

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
  const walletClient = await createWalletClientInstance();
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

// NOTE: addCreator, banCreator, changePlatformFee, addNewTokenSupport
// are managed via bash/makefile using foundry cast commands
