/**
 * Prisma Database Client
 *
 * This module exports a singleton Prisma client instance for database operations.
 */

import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Create adapter factory
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Global Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Alias for backward compatibility
export const db = prisma;

/**
 * Disconnect from database (useful for cleanup)
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}
