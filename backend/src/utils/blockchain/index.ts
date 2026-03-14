/**
 * Blockchain Service
 *
 * Handles interactions with the LogersWatch smart contract
 */

import {
  createPublicClient,
  createWalletClient,
  fallback,
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
  {
    name: "getTotaldepositedByUser",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ERC20 ABI for token decimals
export const ERC20_ABI = [
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// Chain configuration
const CHAIN_MAP: Record<string, Chain> = {
  sepolia,
  mainnet,
  localhost,
};

const DEFAULT_RPC_URL = "http://127.0.0.1:8545";

function parsePositiveIntegerEnv(name: string, fallbackValue: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallbackValue;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallbackValue;

  return parsed;
}

const RPC_TIMEOUT_MS = parsePositiveIntegerEnv("RPC_TIMEOUT_MS", 15_000);
const RPC_RETRY_COUNT = parsePositiveIntegerEnv("RPC_RETRY_COUNT", 2);
const RPC_RETRY_DELAY_MS = parsePositiveIntegerEnv("RPC_RETRY_DELAY_MS", 300);
const MERKLE_SIMULATION_RETRIES = parsePositiveIntegerEnv(
  "MERKLE_SIMULATION_RETRIES",
  3,
);

// Get chain from environment
function getChain(): Chain {
  const chainName = process.env.CHAIN_NAME || "localhost";
  const chain = CHAIN_MAP[chainName];
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }
  return chain;
}

// Get validated RPC URLs (primary + optional fallback)
function getRpcUrls(): string[] {
  const candidates = [process.env.RPC_URL, process.env.RPC_FALLBACK_URL]
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url));

  const urls = candidates.length > 0 ? candidates : [DEFAULT_RPC_URL];

  for (const url of urls) {
    try {
      // Throws for malformed URLs and gives quick feedback at startup/use-time.
      new URL(url);
    } catch {
      throw new Error(`Invalid RPC URL: '${url}'`);
    }
  }

  return urls;
}

function createRpcTransport() {
  const urls = getRpcUrls();
  const transports = urls.map((url) =>
    http(url, {
      timeout: RPC_TIMEOUT_MS,
      retryCount: RPC_RETRY_COUNT,
      retryDelay: RPC_RETRY_DELAY_MS,
    }),
  );

  return transports.length === 1 ? transports[0] : fallback(transports);
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

// Get supported token address
function getTokenAddress(): Address {
  const address = process.env.SUPPORTED_TOKEN_ADDRESS;
  if (!address) {
    throw new Error("SUPPORTED_TOKEN_ADDRESS environment variable not set");
  }
  return address as Address;
}

// Create public client for read operations
export function createPublicClientInstance(): PublicClient {
  return createPublicClient({
    chain: getChain(),
    transport: createRpcTransport(),
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
    transport: createRpcTransport(),
  });
}

function isHttpRequestFailure(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes("HTTP request failed") ||
    text.includes("fetch failed") ||
    text.includes("Failed to fetch") ||
    text.includes("ETIMEDOUT") ||
    text.includes("ECONNREFUSED")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Get total deposited amount by user from contract
 */
export async function getTotalDepositedByUser(user: Address): Promise<bigint> {
  const client = createPublicClientInstance();
  const contractAddress = getContractAddress();

  const deposited = await client.readContract({
    address: contractAddress,
    abi: LOGERS_WATCH_ABI,
    functionName: "getTotaldepositedByUser",
    args: [user],
  });

  return deposited as bigint;
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
  const rpcUrls = getRpcUrls();

  // Simulate first to check for errors and retry for transient RPC failures.
  for (let attempt = 1; attempt <= MERKLE_SIMULATION_RETRIES; attempt++) {
    try {
      await publicClient.simulateContract({
        address: contractAddress,
        abi: LOGERS_WATCH_ABI,
        functionName: "setMerkleRoot",
        args: [root],
        account: walletClient.account,
      });
      break;
    } catch (error) {
      const isLastAttempt = attempt === MERKLE_SIMULATION_RETRIES;
      if (!isHttpRequestFailure(error) || isLastAttempt) {
        const details =
          error instanceof Error ? error.message : "Unknown error";
        throw new Error(
          `setMerkleRoot simulation failed against RPC ${rpcUrls.join(", ")}. ${details}`,
        );
      }

      console.warn(
        `[Blockchain] setMerkleRoot simulation attempt ${attempt}/${MERKLE_SIMULATION_RETRIES} failed. Retrying...`,
      );
      await sleep(250 * attempt);
    }
  }

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
 * Get token decimals from ERC20 contract
 * USDC has 6 decimals, most other tokens have 18
 */
export async function getTokenDecimals(): Promise<number> {
  const client = createPublicClientInstance();
  const tokenAddress = getTokenAddress();

  try {
    const decimals = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    return Number(decimals);
  } catch (error) {
    // Default to 6 decimals (USDC standard)
    console.warn("Failed to get token decimals, defaulting to 6:", error);
    return 6;
  }
}

// NOTE: addCreator, banCreator, changePlatformFee, addNewTokenSupport
// are managed via bash/makefile using foundry cast commands
