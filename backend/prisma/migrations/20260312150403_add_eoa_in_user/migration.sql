/*
  Warnings:

  - A unique constraint covering the columns `[eoaAddress]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "eoaAddress" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_eoaAddress_key" ON "User"("eoaAddress");

-- CreateIndex
CREATE INDEX "User_eoaAddress_idx" ON "User"("eoaAddress");
