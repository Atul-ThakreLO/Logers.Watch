# Logers.Watch - Complete Project Overview

A **Web3 Watch-to-Earn** platform where users pay to watch videos and creators earn based on watch time, with on-chain deposits and merkle-proof based claims.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Smart Contract](#smart-contract)
3. [Backend API](#backend-api)
4. [Frontend](#frontend)
5. [Database Schema](#database-schema)
6. [Key Flows](#key-flows)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  User Auth   │  │ Creator Auth │  │ Video Player │                  │
│  │  + Deposit   │  │  + Upload    │  │  + Billing   │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
└─────────┼─────────────────┼─────────────────┼──────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Elysia.js)                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │   Auth   │ │   User   │ │ Creator  │ │  Video   │ │ Billing  │     │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │ │  Module  │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       │            │            │            │            │            │
│  ┌────▼────────────▼────────────▼────────────▼────────────▼─────┐     │
│  │                    PostgreSQL (Prisma)                        │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐           │
│  │     Redis      │  │    BullMQ      │  │   Cron Job     │           │
│  │ (Session/Cache)│  │ (Video Process)│  │ (Merkle Update)│           │
│  └────────────────┘  └────────────────┘  └────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
          │                                          │
          ▼                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SMART CONTRACT (Solidity)                            │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  LogersWatch.sol                                                   │ │
│  │  - User Deposits (EIP-2612 Permit / Standard Approval)            │ │
│  │  - Creator Claims (Merkle Proof Verification)                     │ │
│  │  - Platform Fee Management                                        │ │
│  │  - Access Control (Roles)                                         │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Smart Contract

**File:** `contracts/src/LogersWatch.sol`

### State Variables

| Variable             | Type                          | Description                                |
| -------------------- | ----------------------------- | ------------------------------------------ |
| `MERKLE_ROOT`        | `bytes32`                     | Current merkle root for claim verification |
| `PLATFORM_FEE`       | `uint256`                     | Fee percentage (default: 10% = 1e17)       |
| `CREATOR_CLAIM_ROLE` | `bytes32`                     | Role hash for claim permission             |
| `isVerifiedCreator`  | `mapping(address => bool)`    | Creator verification status                |
| `creatorWithdrawn`   | `mapping(address => uint256)` | Amount already claimed by creator          |
| `userDepositAmount`  | `mapping(address => uint256)` | Total deposited by user                    |
| `isSupportedTokens`  | `mapping(address => bool)`    | Supported ERC20 tokens                     |

### User Functions

| Function               | Parameters                        | Description                                                 |
| ---------------------- | --------------------------------- | ----------------------------------------------------------- |
| `deposit`              | `token, value, deadline, v, r, s` | Deposit with EIP-2612 permit (gasless approval)             |
| `depositWithoutPermit` | `token, value`                    | Deposit with standard approval (requires prior `approve()`) |

### Creator Functions

| Function | Parameters                      | Description                       |
| -------- | ------------------------------- | --------------------------------- |
| `claim`  | `proof[], totalEarnings, token` | Claim earnings using merkle proof |

**Claim Logic:**

```solidity
// Verify merkle proof
bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, totalEarnings))));
require(MerkleProof.verify(proof, MERKLE_ROOT, leaf), "Invalid proof");

// Calculate claimable amount
uint256 claimableAmount = totalEarnings - creatorWithdrawn[msg.sender];
uint256 fee = (claimableAmount * PLATFORM_FEE) / 1e18;
uint256 finalAmount = claimableAmount - fee;

// Transfer to creator
token.transfer(msg.sender, finalAmount);
```

### Admin Functions (Owner Only)

| Function                    | Description                         |
| --------------------------- | ----------------------------------- |
| `setMerkleRoot(root)`       | Update merkle root for claims       |
| `addCreator(creator)`       | Register creator + grant claim role |
| `banCreator(creator)`       | Revoke creator status + role        |
| `addNewTokenSupport(token)` | Add supported ERC20 token           |
| `banTokenSupport(token)`    | Remove token support                |
| `changePlatformFee(newFee)` | Update platform fee percentage      |

### View Functions

| Function                              | Returns                  |
| ------------------------------------- | ------------------------ |
| `getTotaldepositedByUser(user)`       | User's total deposits    |
| `getTotalWithdrawnByCreator(creator)` | Creator's total claims   |
| `getPlatformFee()`                    | Current platform fee     |
| `getCreators()`                       | List of all creators     |
| `getSupportedTokens()`                | List of supported tokens |
| `getCreatorStstus()`                  | Caller's creator status  |

### Events

| Event               | Parameters        | Description              |
| ------------------- | ----------------- | ------------------------ |
| `Deposited`         | `user, amount`    | User deposited tokens    |
| `Claimed`           | `creator, amount` | Creator claimed earnings |
| `RootChange`        | -                 | Merkle root updated      |
| `AddCreator`        | `creator`         | Creator registered       |
| `BanCreator`        | `creator`         | Creator banned           |
| `ChangePlatformFee` | `newFee`          | Fee updated              |

---

## Backend API

**Stack:** Elysia.js, PostgreSQL, Prisma, Redis, BullMQ

**Base URL:** `http://localhost:3000/api/v1`

### Authentication Routes (`/auth`)

| Route         | Method | Auth    | Description                               |
| ------------- | ------ | ------- | ----------------------------------------- |
| `/register`   | POST   | ❌      | Register user - `{email, password, name}` |
| `/login`      | POST   | ❌      | Login - returns JWT tokens                |
| `/refresh`    | POST   | ❌      | Refresh access token                      |
| `/logout`     | POST   | ❌      | Clear cookies                             |
| `/revoke-all` | POST   | ✅ User | Revoke all refresh tokens                 |

### User Routes (`/users`)

| Route  | Method | Auth    | Description           |
| ------ | ------ | ------- | --------------------- |
| `/me`  | GET    | ✅ User | Get profile + balance |
| `/:id` | GET    | ✅ User | Get user by ID        |
| `/me`  | PATCH  | ✅ User | Update profile        |
| `/me`  | DELETE | ✅ User | Delete account        |

### Creator Routes (`/creators`)

| Route              | Method | Auth       | Description                                           |
| ------------------ | ------ | ---------- | ----------------------------------------------------- |
| `/register`        | POST   | ❌         | Register creator - `{email, password, name, company}` |
| `/login`           | POST   | ❌         | Creator login                                         |
| `/me`              | GET    | ✅ Creator | Get profile with earnings                             |
| `/me/videos`       | GET    | ✅ Creator | Get creator's videos                                  |
| `/me`              | PATCH  | ✅ Creator | Update profile                                        |
| `/me/eoa`          | PATCH  | ✅ Creator | Set wallet address - `{eoaAddress}`                   |
| `/me`              | DELETE | ✅ Creator | Delete account                                        |
| `/me/claim-proof`  | GET    | ✅ Creator | Get merkle proof for claiming                         |
| `/me/verify-proof` | GET    | ✅ Creator | Verify proof validity                                 |

**Claim Proof Response:**

```json
{
  "success": true,
  "data": {
    "proof": ["0x...", "0x..."],
    "totalEarnings": "1000000000000000000",
    "root": "0x...",
    "creatorAddress": "0x..."
  }
}
```

### Video Routes (`/videos`)

| Route                           | Method | Auth       | Description                        |
| ------------------------------- | ------ | ---------- | ---------------------------------- |
| `/`                             | GET    | ❌         | List videos - `?page=1&limit=20`   |
| `/:id`                          | GET    | ❌         | Get video by database ID           |
| `/v/:videoId`                   | GET    | ❌         | Get video by videoId               |
| `/stream/:videoId/manifest.mpd` | GET    | ✅ User    | Get DASH manifest (starts billing) |
| `/stream/:videoId/:segmentName` | GET    | ✅ User    | Get segment (charges $0.0002)      |
| `/upload`                       | POST   | ✅ Creator | Upload video file (multipart)      |
| `/status/:videoId`              | GET    | ✅ Creator | Get processing status              |
| `/`                             | POST   | ✅ Creator | Create video record                |
| `/:id`                          | PATCH  | ✅ Creator | Update video                       |
| `/:id`                          | DELETE | ✅ Creator | Delete video                       |

**Upload Flow:**

1. `POST /upload` - uploads file to temp folder
2. BullMQ job processes with FFmpeg → DASH format
3. `GET /status/:videoId` - poll until `status: "READY"`

### Billing Routes (`/billing`)

| Route     | Method | Auth    | Description                      |
| --------- | ------ | ------- | -------------------------------- |
| `/status` | GET    | ✅ User | Get balance + pending deductions |

**Response:**

```json
{
  "status": {
    "userId": "...",
    "dbBalance": 100.0,
    "pendingDeduction": 0.02,
    "effectiveBalance": 99.98,
    "activeSession": { "videoId": "...", "creatorId": "..." }
  }
}
```

> **Note:** `/recharge` and `/settle` routes removed - now handled on-chain via smart contract

### Admin Routes (`/admin`)

| Route             | Method | Auth     | Description                    |
| ----------------- | ------ | -------- | ------------------------------ |
| `/health`         | GET    | ❌       | Health check                   |
| `/merkle/trigger` | POST   | ✅ Admin | Manually trigger merkle update |
| `/merkle/history` | GET    | ✅ Admin | Get merkle update history      |
| `/merkle/active`  | GET    | ✅ Admin | Get active merkle tree         |

### WebSocket (`/ws/billing`)

**URL:** `ws://localhost:3000/ws/billing?token=<jwt>`

| Message Type          | Direction       | Description                   |
| --------------------- | --------------- | ----------------------------- |
| `start_session`       | Client → Server | Start watch session for video |
| `end_session`         | Client → Server | End watch session             |
| `get_status`          | Client → Server | Request current status        |
| `ping`                | Client → Server | Keep-alive                    |
| `session_started`     | Server → Client | Session started confirmation  |
| `balance_update`      | Server → Client | Real-time balance update      |
| `settlement_complete` | Server → Client | 10-min settlement done        |

---

## Frontend

**Stack:** Next.js 16, React 19, wagmi 3, viem, RainbowKit, TailwindCSS

### Pages

#### Public Pages

| Path                     | Description                   |
| ------------------------ | ----------------------------- |
| `/`                      | Homepage - video catalog      |
| `/auth/login`            | User login                    |
| `/auth/register`         | User registration             |
| `/auth/creator/login`    | Creator login                 |
| `/auth/creator/register` | Creator registration          |
| `/watch/[id]`            | Video player (requires login) |

#### User Pages (Authenticated)

| Path                | Description                       |
| ------------------- | --------------------------------- |
| `/profile`          | User dashboard                    |
| `/profile/balance`  | Balance overview                  |
| `/profile/recharge` | Deposit tokens via smart contract |
| `/profile/settings` | Account settings                  |

#### Creator Pages (Creator Auth)

| Path                 | Description                      |
| -------------------- | -------------------------------- |
| `/creator/dashboard` | Creator analytics                |
| `/creator/videos`    | Manage videos                    |
| `/creator/upload`    | Upload new video                 |
| `/creator/earnings`  | Claim earnings with merkle proof |
| `/creator/settings`  | Set wallet address (EOA)         |

### API Services (`src/lib/api/`)

| File         | Methods                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| `auth.ts`    | `login`, `register`, `creatorLogin`, `creatorRegister`, `logout`, `refresh` |
| `user.ts`    | `getMe`, `updateMe`, `deleteMe`                                             |
| `creator.ts` | `getMe`, `updateEoa`, `getClaimProof`, `verifyProof`                        |
| `video.ts`   | `getVideos`, `getVideo`, `uploadVideo`, `getUploadStatus`                   |
| `billing.ts` | `getStatus`                                                                 |

### Custom Hooks

#### `useLogersWatch.ts`

Contract interaction hook using wagmi:

```typescript
const {
  // Balances
  userBalance, // Deposited amount
  tokenBalance, // Wallet token balance
  tokenAllowance, // Approved amount
  creatorBalance, // Withdrawn amount

  // Token info
  tokenDecimals,
  tokenSymbol,

  // Functions
  depositWithPermit, // Gasless deposit (signs EIP-2612 permit)
  depositWithoutPermit, // Standard deposit (requires approval)
  approveToken, // Approve tokens for contract
  claimEarnings, // Claim with merkle proof

  // State
  isProcessing,
  refetchBalances,
} = useLogersWatch();
```

#### `useAuth.tsx` / `useCreatorAuth.tsx`

Authentication context hooks:

- `user` / `creator` - Current authenticated entity
- `login(email, password)` - Authenticate
- `logout()` - Clear tokens
- `isAuthenticated` - Boolean status

#### `useBillingWebSocket.ts`

Real-time billing during video playback:

- `startSession(videoId)` - Begin billing
- `endSession()` - Stop billing
- `balance` - Current balance
- `pendingDeduction` - Accumulated charges

### Contract Config (`src/lib/contracts/logersWatch.ts`)

```typescript
export const LOGERS_WATCH_ADDRESS = "0x...";  // Set after deployment
export const SUPPORTED_TOKEN_ADDRESS = "0x..."; // USDC/USDT address
export const LOGERS_WATCH_ABI = [...];
export const ERC20_ABI = [...];
export const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};
```

---

## Database Schema

**File:** `backend/prisma/schema.prisma`

### Models

#### User (Video Viewers)

```prisma
model User {
  id               String   @id @default(uuid())
  name             String
  email            String   @unique
  password         String
  balance          Float    @default(0)
  lastRechargeAmount Float?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  refreshTokens    RefreshToken[]
}
```

#### Creator (Content Creators)

```prisma
model Creator {
  id          String   @id @default(uuid())
  name        String
  email       String   @unique
  company     String?
  password    String
  watchTime   Float    @default(0)    // Accumulated watch time (seconds)
  amountEarned Float   @default(0)    // Earnings in database
  eoaAddress  String?  @unique        // Wallet address for claims
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  videos      Video[]
}
```

#### Video

```prisma
model Video {
  id           String          @id @default(uuid())
  videoId      String          @unique @default(uuid())
  title        String
  description  String?
  thumbnailUrl String?
  mpdFileUrl   String?         // Path to DASH manifest
  status       ProcessingStatus @default(PENDING)
  duration     Float?          // Duration in seconds
  segmentCount Int?            // Number of DASH segments
  errorMessage String?         // Error if processing failed
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  creatorId    String
  creator      Creator         @relation(fields: [creatorId], references: [id])
}

enum ProcessingStatus {
  PENDING
  PROCESSING
  READY
  FAILED
}
```

#### MerkleTree

```prisma
model MerkleTree {
  id              String   @id @default(uuid())
  root            String   @unique   // Merkle root hash
  transactionHash String?            // On-chain tx hash
  creatorsCount   Int                // Number of creators in tree
  totalEarnings   String             // Total earnings (BigInt string)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  proofs          MerkleTreeProof[]
}
```

#### MerkleTreeProof

```prisma
model MerkleTreeProof {
  id             String     @id @default(uuid())
  merkleTreeId   String
  merkleTree     MerkleTree @relation(...)
  creatorAddress String     // EOA address
  totalEarnings  String     // Earnings (BigInt string)
  proof          String[]   // Array of proof hashes
  createdAt      DateTime   @default(now())

  @@unique([merkleTreeId, creatorAddress])
}
```

---

## Key Flows

### 1. User Deposit Flow

```
Frontend (Recharge Page)
         │
         ├── Option A: Permit (Gasless)
         │   1. Sign EIP-2612 typed data (deadline, nonce, value)
         │   2. Call contract.deposit(token, value, deadline, v, r, s)
         │   3. Contract calls token.permit() + token.transferFrom()
         │
         └── Option B: Standard Approval
             1. Call token.approve(contract, amount)
             2. Call contract.depositWithoutPermit(token, value)
             3. Contract calls token.transferFrom()

Smart Contract
         │
         └── Emits Deposited(user, amount)
             Updates userDepositAmount[user]
```

### 2. Video Streaming & Billing Flow

```
User clicks Play
         │
         ▼
Frontend calls /videos/stream/:videoId/manifest.mpd
         │
         ▼
Backend starts billing session in Redis
         │
         ▼
Frontend requests segments (/stream/:videoId/chunk-*.m4s)
         │
         ▼
Backend deducts $0.0002/segment from Redis pending
         │
         ▼
WebSocket sends balance_update to frontend
         │
         ▼
Every 10 minutes: Redis → PostgreSQL settlement
  - User.balance decremented
  - Creator.watchTime incremented
  - Creator.amountEarned incremented
```

### 3. Video Upload & Processing Flow

```
Creator uploads file
         │
         ▼
POST /videos/upload (multipart form)
         │
         ▼
Backend saves to temp/, creates Video record (PENDING)
         │
         ▼
BullMQ job added to video-processing queue
         │
         ▼
Worker picks up job:
  1. FFmpeg converts to DASH format
  2. Creates manifest.mpd + chunk-stream*.m4s files
  3. Updates Video status → READY
         │
         ▼
Frontend polls GET /videos/status/:videoId until READY
```

### 4. Merkle Tree Generation & Creator Claim Flow

```
Cron Job (hourly)
         │
         ▼
Query creators with eoaAddress
         │
         ▼
Calculate earnings per creator:
  earnings = watchTimeSeconds * EARNINGS_RATE_PER_SECOND
         │
         ▼
Build StandardMerkleTree using OpenZeppelin library
  Leaf = keccak256(keccak256(abi.encode(address, totalEarnings)))
         │
         ▼
Call contract.setMerkleRoot(root) via admin wallet
         │
         ▼
Store tree + proofs in database
         │
         ▼
Creator fetches proof: GET /creators/me/claim-proof
         │
         ▼
Frontend calls contract.claim(proof, totalEarnings, token)
         │
         ▼
Contract verifies proof, calculates:
  claimable = totalEarnings - creatorWithdrawn[creator]
  fee = claimable * PLATFORM_FEE / 1e18
  payout = claimable - fee
         │
         ▼
Contract transfers payout to creator
Emits Claimed(creator, amount)
```

---

## Configuration

### Environment Variables

**Backend (`.env`):**

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret
MERKLE_UPDATE_CRON="0 * * * *"  # Hourly
EARNINGS_RATE_PER_SECOND=0.0001
VIDEO_WORKER_CONCURRENCY=2
CONTRACT_ADDRESS=0x...
ADMIN_PRIVATE_KEY=0x...  # For merkle root updates
```

**Frontend (`.env.local`):**

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_ADDRESS=0x...
```

---

## Summary

| Component                | Technology | Count |
| ------------------------ | ---------- | ----- |
| Smart Contract Functions | Solidity   | 16    |
| API Routes               | Elysia.js  | ~30   |
| Database Models          | Prisma     | 6     |
| Frontend Pages           | Next.js    | 14    |
| Custom Hooks             | React      | 4     |
| Background Workers       | BullMQ     | 1     |
| Cron Jobs                | Node-cron  | 1     |
