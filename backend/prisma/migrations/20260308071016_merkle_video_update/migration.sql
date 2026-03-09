-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "segmentCount" INTEGER,
ADD COLUMN     "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "title" TEXT,
ALTER COLUMN "mpdFileUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MerkleTree" (
    "id" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "transactionHash" TEXT,
    "creatorsCount" INTEGER NOT NULL,
    "totalEarnings" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerkleTree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerkleTreeProof" (
    "id" TEXT NOT NULL,
    "merkleTreeId" TEXT NOT NULL,
    "creatorAddress" TEXT NOT NULL,
    "totalEarnings" TEXT NOT NULL,
    "proof" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerkleTreeProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerkleTree_root_key" ON "MerkleTree"("root");

-- CreateIndex
CREATE INDEX "MerkleTree_root_idx" ON "MerkleTree"("root");

-- CreateIndex
CREATE INDEX "MerkleTree_isActive_idx" ON "MerkleTree"("isActive");

-- CreateIndex
CREATE INDEX "MerkleTreeProof_creatorAddress_idx" ON "MerkleTreeProof"("creatorAddress");

-- CreateIndex
CREATE UNIQUE INDEX "MerkleTreeProof_merkleTreeId_creatorAddress_key" ON "MerkleTreeProof"("merkleTreeId", "creatorAddress");

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "Video"("status");

-- AddForeignKey
ALTER TABLE "MerkleTreeProof" ADD CONSTRAINT "MerkleTreeProof_merkleTreeId_fkey" FOREIGN KEY ("merkleTreeId") REFERENCES "MerkleTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
