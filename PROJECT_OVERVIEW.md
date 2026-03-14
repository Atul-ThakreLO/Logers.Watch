# Logers.Watch - Project Overview

## 1. What This Project Is

Logers.Watch is a tokenized video platform with three core ideas:
- users pre-fund viewing by depositing supported ERC-20 tokens,
- watch consumption is tracked and billed by the backend while streaming,
- creators claim cumulative earnings on-chain using Merkle proofs.

It is built as a monorepo with:
- `frontend/` (Next.js 16 + React 19),
- `backend/` (Bun + Elysia + Prisma + Redis + BullMQ),
- `contracts/` (Solidity + Foundry).

## 2. Current Maturity

- feature development is complete for the intended project scope.
- this is not yet fully production-hardened.
- aggressive real-world testing was not completed.

Use this overview as technical documentation for understanding and handover.

## 3. High-Level System Design

```text
[Frontend]
  - user auth / creator auth
  - video browsing and playback
  - wallet + contract interactions
          |
          v
[Backend API + WebSocket]
  - auth, user, creator, video, billing, admin
  - realtime pending billing in Redis
  - periodic settlement to PostgreSQL
  - Merkle tree generation and root updates
          |
          v
[Smart Contract]
  - user deposits (permit or approve+deposit)
  - creator claims (Merkle proof verification)
  - platform fee extraction
```

## 4. Component Responsibilities

### 4.1 Frontend (`frontend/`)

Primary responsibilities:
- user and creator login/registration UX
- video listing and watch page
- creator upload and earnings claim flow
- wallet connect and contract transactions

Key route pages include:
- `/`
- `/watch/[id]`
- `/auth/login`, `/auth/register`
- `/auth/creator/login`, `/auth/creator/register`
- `/profile`, `/profile/balance`, `/profile/recharge`, `/profile/settings`
- `/creator/dashboard`, `/creator/analytics`, `/creator/videos`, `/creator/upload`, `/creator/earnings`, `/creator/settings`

Key env variables:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_PROJECT_ID`
- `NEXT_PUBLIC_LOGERS_WATCH_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_SUPPORTED_TOKEN_ADDRESS`

### 4.2 Backend (`backend/`)

Primary responsibilities:
- authentication for users and creators
- video metadata and streaming endpoints
- billing computation and status
- on-chain sync utilities for balances and merkle flow
- background jobs for video processing and scheduled merkle updates

Server startup:
- `src/index.ts` listens on port `3000`
- CORS origin configured to `http://localhost:3001`
- cron and worker are started from server entrypoint

### 4.3 Smart Contract (`contracts/`)

Contract file:
- `contracts/src/LogersWatch.sol`

Primary responsibilities:
- accept deposits into protocol contract balance
- verify and execute creator claims using active Merkle root
- enforce owner/admin operations (root updates, token support, creator roles)

## 5. Backend API Modules

Base URL: `http://localhost:3000/api/v1`

### 5.1 Auth (`/auth`)

- `POST /register`
- `POST /login`
- `POST /refresh`
- `POST /logout`
- `POST /revoke-all` (authenticated)
- `POST /stream-token` (authenticated)

### 5.2 Users (`/users`)

- `GET /me`
- `GET /:id`
- `PATCH /me`
- `DELETE /me`

### 5.3 Creators (`/creators`)

Public:
- `POST /register`
- `POST /login`
- `POST /refresh`
- `POST /logout`

Protected:
- `GET /me`
- `GET /me/videos`
- `PATCH /me`
- `PATCH /me/eoa`
- `DELETE /me`
- `GET /me/claim-proof`
- `GET /me/verify-proof`

### 5.4 Videos (`/videos`)

Catalog/public:
- `GET /`
- `GET /v/:videoId`
- `GET /:id`

User-protected stream:
- `GET /stream/:videoId/:segmentName`

Creator-protected management:
- `POST /upload`
- `GET /status/:videoId`
- `GET /pending`
- `POST /`
- `PATCH /:id`
- `DELETE /:id`

### 5.5 Billing (`/billing`)

- `GET /status`
- `PATCH /wallet`
- `POST /sync`

Note:
- legacy `/recharge` and `/settle` API routes were removed.
- on-chain deposit/claim replaced direct recharge/settle endpoints.

### 5.6 Admin (`/admin`)

- `GET /health`
- `POST /merkle/trigger`
- `GET /merkle/history`
- `GET /merkle/active`

### 5.7 WebSocket

- `ws://localhost:3000/ws/billing?token=<jwt>`
- supports session control and live balance/status events

## 6. Billing And Earnings Model

### 6.1 Viewer Charging

Defined in `backend/src/modules/billing/model.ts`:
- `COST_PER_REQUEST = 0.0002`
- baseline segment duration = `4s`
- `COST_PER_SECOND = COST_PER_REQUEST / 4`

In stream handling:
- only target video media segments are billed,
- pending deduction is tracked in Redis,
- insufficient effective balance blocks segment delivery.

### 6.2 Effective Balance Logic

At runtime, effective spendable balance is:
- `dbBalance = User.balance - User.totalConsumed`
- `effectiveBalance = dbBalance - pendingDeduction`

Where:
- `User.balance` is synced from on-chain deposited total,
- `User.totalConsumed` is settled usage,
- `pendingDeduction` is in-memory/Redis pre-settlement usage.

### 6.3 Creator Earnings

- watch time accumulates per creator,
- settlement increments `Creator.watchTime` and `Creator.amountEarned`,
- Merkle updater computes payable amounts from watch time using `EARNINGS_RATE_PER_SECOND`.

## 7. Merkle Payout Pipeline

1. Collect creators with linked wallet addresses.
2. Convert watch time to whole-second deterministic values.
3. Compute token-unit earnings (`EARNINGS_RATE_PER_SECOND`, token decimals aware).
4. Build Merkle tree and proof rows.
5. If root changed, call on-chain `setMerkleRoot`; if unchanged, keep idempotent update.
6. Store active root + proofs in DB.
7. Creator fetches proof from `/creators/me/claim-proof`.
8. Creator claims on-chain using `claim(proof, totalEarnings, token)`.

## 8. Database Model Summary (Prisma)

Main tables/models:
- `User`
- `Creator`
- `Video`
- `RefreshToken`
- `MerkleTree`
- `MerkleTreeProof`

Important fields:
- `User.balance`, `User.totalConsumed`, `User.eoaAddress`
- `Creator.watchTime`, `Creator.amountEarned`, `Creator.eoaAddress`
- `Video.status` with values: `PENDING | PROCESSING | READY | FAILED`

## 9. Local Development Topology

### 9.1 Infra

`backend/docker-compose.yml` starts:
- Postgres 16 (`localhost:5432` default)
- Redis 7 (`localhost:6379` default)

### 9.2 Backend Run

```bash
cd backend
bun install
bun run db:generate
bun run db:migrate
bun run dev
```

### 9.3 Frontend Run

```bash
cd frontend
npm install
npm run dev -- -p 3001
```

### 9.4 Contracts Run

```bash
cd contracts
forge build
forge test
```

## 10. Security And Operational Notes

- Admin routes require admin API key or valid admin JWT.
- JWT cookie security flags are production-sensitive (`secure` in production).
- Streaming routes include path traversal checks for segment names.
- Merkle updater has in-flight lock to avoid overlapping runs.
- RPC fallback can be configured (`RPC_FALLBACK_URL`) to reduce chain-read failures.

## 11. Known Gaps / Risk Areas

Because the project is complete but not heavily production-tested, key residual risks include:
- concurrency edge cases under high request throughput,
- long-session reconciliation and partial-failure recovery,
- creator/user auth abuse hardening,
- deep adversarial testing for streaming and billing race conditions,
- final smart-contract audit quality level.

## 12. Practical Handover Guidance

If someone continues this project, recommended order:
1. Verify local run end-to-end (upload -> stream -> billing -> claim proof).
2. Add comprehensive integration tests across backend + frontend + chain interactions.
3. Perform contract security review and freeze ABI/upgrade policy.
4. Add deployment docs with exact staging/prod env templates.
5. Add observability (metrics, tracing, alerts) before public launch.
