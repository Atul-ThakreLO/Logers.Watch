# Frontend Smart Contract Integration Changes

## Summary

The frontend has been updated to integrate with the LogersWatch smart contract for:

1. **User deposits** (recharge) using EIP-2612 Permit or standard approval
2. **Creator earnings claims** using Merkle proofs
3. **Video uploads** with background processing

---

## New Files Created

### 1. Contract Configuration

**File:** `frontend/src/lib/contracts/logersWatch.ts`

- Contains `LOGERS_WATCH_ABI` - Full ABI for LogersWatch contract
- Contains `ERC20_ABI` - Standard ERC20 + permit functions
- Contains `PERMIT_TYPES` - EIP-712 typed data for permit signatures
- Exports `LOGERS_WATCH_ADDRESS` and `SUPPORTED_TOKEN_ADDRESS` (needs to be set)

### 2. Contract Hook

**File:** `frontend/src/hooks/useLogersWatch.ts`

- Custom React hook for contract interactions
- **Functions:**
  - `depositWithPermit(amount)` - Deposit with gasless approval (signs permit)
  - `depositWithoutPermit(amount)` - Deposit with prior approval
  - `approveToken(amount)` - Approve token for contract
  - `claimEarnings(proof, totalEarnings)` - Claim with Merkle proof
- **Returns:**
  - Balance info (deposited, token, allowance, withdrawn)
  - Token info (decimals, symbol)
  - Processing state

---

## Updated Files

### 1. User Recharge Page

**File:** `frontend/src/app/profile/recharge/page.tsx`

**Changes:**

- Removed backend `billingService.recharge()` call
- Added `useLogersWatch` hook integration
- Added deposit method selection (Permit vs Approval)
- Shows contract balance and wallet balance
- Handles permit signature flow
- Handles approval + deposit flow

**Features:**

- Permit (recommended) - Single transaction with EIP-2612 signature
- Approval - Two-step process (approve → deposit)
- Shows allowance status for approval method
- Transaction confirmation feedback

---

### 2. Creator Earnings Page

**File:** `frontend/src/app/creator/earnings/page.tsx`

**Changes:**

- Added Merkle proof fetching from backend
- Added on-chain claim functionality
- Shows total claimed, claimable amount, total earned
- Two-step claim process (fetch proof → claim on-chain)

**Features:**

- Validates wallet address matches registered address
- Displays proof details before claiming
- Shows claimable amount (totalEarnings - alreadyWithdrawn)
- Transaction confirmation feedback

---

### 3. Creator API Service

**File:** `frontend/src/lib/api/creator.ts`

**Added Methods:**

```typescript
getClaimProof(): Promise<{
  success: boolean;
  data: {
    proof: string[];
    totalEarnings: string;
    root: string;
    creatorAddress: string;
  };
}>

verifyClaimProof(): Promise<{
  success: boolean;
  data: {
    address: string;
    isValid: boolean;
  };
}>
```

---

### 4. Video Service

**File:** `frontend/src/lib/api/video.ts`

**Added Types:**

```typescript
type VideoStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

interface UploadResult {
  message: string;
  video: {
    id: string;
    videoId: string;
    title?: string;
    status: VideoStatus;
  };
}

interface VideoStatusResult {
  video: {...};
  jobProgress?: {
    state: string;
    progress: number;
  } | null;
}
```

**Added Methods:**

```typescript
uploadVideo(file: File, title?: string, onProgress?: (progress: number) => void): Promise<UploadResult>
getVideoStatus(videoId: string): Promise<VideoStatusResult>
pollVideoStatus(videoId: string, onStatusChange?, intervalMs?, maxAttempts?): Promise<VideoStatusResult>
```

---

### 5. Creator Upload Page

**File:** `frontend/src/app/creator/upload/page.tsx`

**Changes:**

- Completely rewritten for file upload
- Drag-and-drop file selection
- Upload progress tracking
- Processing status polling
- Stage-based UI (select → uploading → processing → complete/error)

**Features:**

- File type validation (MP4, WebM, MOV, AVI)
- File size validation (max 2GB)
- Real-time upload progress
- Real-time processing progress
- Auto-redirect on completion

---

## Backend Routes Status

### Routes to KEEP:

| Route                           | Purpose                                       | Status                             |
| ------------------------------- | --------------------------------------------- | ---------------------------------- |
| `GET /billing/status`           | Show user's current balance and session info  | Keep                               |
| `GET /billing/history`          | Show transaction history                      | Keep                               |
| `POST /billing/settle`          | Settle watch session (updates earnings in DB) | Keep - needed for merkle tree data |
| `GET /creators/me/claim-proof`  | Get merkle proof for claiming                 | Keep                               |
| `GET /creators/me/verify-proof` | Verify proof validity                         | Keep                               |
| `POST /videos/upload`           | Upload video file                             | Keep                               |
| `GET /videos/status/:videoId`   | Get processing status                         | Keep                               |

### Routes to DEPRECATE/REMOVE:

| Route                    | Previous Purpose          | Reason                            |
| ------------------------ | ------------------------- | --------------------------------- |
| `POST /billing/recharge` | Credit user balance in DB | Now on-chain via contract deposit |

### Backend Changes Needed:

1. **Sync contract deposits to DB:**
   - Listen for `Deposited` events from LogersWatch contract
   - Update user's `balanceDeposited` in DB when deposit detected
   - Alternative: Query contract balance on-demand

2. **Update billing status to show contract balance:**
   - `GET /billing/status` should return both DB balance and contract balance
   - Or rely solely on frontend reading contract balance

3. **Consider removing/deprecating:**
   - `POST /billing/recharge` - Users now deposit directly to contract
   - DB `balanceDeposited` field - May be redundant if reading from contract

4. **Merkle tree considerations:**
   - Tree should include all creators with earned amounts
   - Tree should be updated periodically (cron job already set up)
   - `getTotalWithdrawnByCreator` from contract should be subtracted from total earnings

---

## Environment Variables Needed

Add to `frontend/.env.local`:

```
NEXT_PUBLIC_LOGERS_WATCH_ADDRESS=0x...  # Deployed LogersWatch contract
NEXT_PUBLIC_SUPPORTED_TOKEN_ADDRESS=0x... # ERC20 token with permit support
```

Update in `frontend/src/lib/contracts/logersWatch.ts`:

```typescript
export const LOGERS_WATCH_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_LOGERS_WATCH_ADDRESS as Address) || "0x...";
export const SUPPORTED_TOKEN_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_SUPPORTED_TOKEN_ADDRESS as Address) || "0x...";
```

---

## Testing Checklist

### User Deposit (Recharge):

- [ ] Connect wallet
- [ ] Select amount
- [ ] Test Permit flow (single signature + transaction)
- [ ] Test Approval flow (approve transaction → deposit transaction)
- [ ] Verify balance updates on contract
- [ ] Error handling for insufficient balance

### Creator Claim:

- [ ] Verify wallet matches registered address
- [ ] Fetch merkle proof from backend
- [ ] Execute claim transaction
- [ ] Verify tokens received
- [ ] Error handling for no proof available

### Video Upload:

- [ ] Drag-and-drop file selection
- [ ] File type validation
- [ ] File size validation
- [ ] Upload progress tracking
- [ ] Processing status polling
- [ ] Error handling for failed processing
