/**
 * Database & Cache Utilities
 *
 * This module exports Prisma client and Redis cache instances,
 * along with an Elysia decorator for dependency injection.
 */

import { Elysia } from "elysia";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { redis, cache, CacheKeys, disconnectRedis } from "../redis";

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

/**
 * Disconnect all connections (database and cache)
 */
export async function disconnectAll(): Promise<void> {
  await Promise.all([disconnectDatabase(), disconnectRedis()]);
}

// Re-export redis utilities
export { redis, cache, CacheKeys, disconnectRedis };

/**
 * Elysia decorator that provides prisma and redis via context
 * Usage: app.use(dbDecorator)
 * Then access via: ({ prisma, redis, cache }) => { ... }
 */
export const dbDecorator = new Elysia({ name: "db" })
  .decorate("prisma", prisma)
  .decorate("redis", redis)
  .decorate("cache", cache)
  .decorate("cacheKeys", CacheKeys);

// Type exports for context typing
export type DbContext = {
  prisma: typeof prisma;
  redis: typeof redis;
  cache: typeof cache;
  cacheKeys: typeof CacheKeys;
};
