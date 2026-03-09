/**
 * LogersWatch Contract Configuration
 *
 * Contract ABI and address for interacting with the LogersWatch smart contract
 */

import { type Address, type Abi } from "viem";

// Contract address from environment
export const LOGERS_WATCH_ADDRESS = process.env
  .NEXT_PUBLIC_LOGERS_WATCH_CONTRACT_ADDRESS as Address;

// ERC20 Token address (e.g., USDC, DAI)
export const SUPPORTED_TOKEN_ADDRESS = process.env
  .NEXT_PUBLIC_SUPPORTED_TOKEN_ADDRESS as Address;

// LogersWatch Contract ABI
export const LOGERS_WATCH_ABI = [
  // Events
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "RootChange",
    inputs: [],
  },
  {
    type: "event",
    name: "AddCreator",
    inputs: [{ name: "creator", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "BanCreator",
    inputs: [{ name: "creator", type: "address", indexed: true }],
  },

  // Deposit functions
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "depositWithoutPermit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
  },

  // Claim function
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes32[]" },
      { name: "totalEarnings", type: "uint256" },
      { name: "token", type: "address" },
    ],
    outputs: [],
  },

  // View functions
  {
    type: "function",
    name: "getPlatformFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getCreators",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getSupportedTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getTokenStatus",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getCreatorStstus",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getTotalWithdrawnByCreator",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getTotalPlatformFeesPaidByCreator",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getTotaldepositedByUser",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },

  // Errors
  {
    type: "error",
    name: "LogersWatch__TokenNotSupported",
    inputs: [],
  },
  {
    type: "error",
    name: "LogersWatch__AmountMustMoreThanZero",
    inputs: [],
  },
  {
    type: "error",
    name: "LogersWatch__PermitFailed",
    inputs: [],
  },
  {
    type: "error",
    name: "LogersWatch__ClaimFail",
    inputs: [],
  },
  {
    type: "error",
    name: "LogersWatch__UnAuthorizedAccount",
    inputs: [],
  },
  {
    type: "error",
    name: "LogersWatch__MerkleRootNotSet",
    inputs: [],
  },
] as const;

// ERC20 ABI (for approval and balance checks)
export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  // ERC20Permit functions
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

// Permit type data for EIP-2612
export const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
