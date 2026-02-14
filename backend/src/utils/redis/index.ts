/**
 * Redis Client
 *
 * This module exports a singleton Redis client instance for caching operations.
 */

import Redis from "ioredis";

// Global Redis client instance
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  },

  /**
   * Set a cached value with optional TTL (in seconds)
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const data = typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, data);
    } else {
      await redis.set(key, data);
    }
  },

  /**
   * Delete a cached value
   */
  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  /**
   * Delete multiple keys by pattern
   */
  async delByPattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    return (await redis.exists(key)) === 1;
  },

  /**
   * Get or set with callback
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await callback();
    await this.set(key, value, ttlSeconds);
    return value;
  },
};

// Cache key prefixes for different entities
export const CacheKeys = {
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  creator: (id: string) => `creator:${id}`,
  creatorByEmail: (email: string) => `creator:email:${email}`,
  video: (id: string) => `video:${id}`,
  videoByVideoId: (videoId: string) => `video:vid:${videoId}`,
  creatorVideos: (creatorId: string) => `creator:${creatorId}:videos`,
  // Billing related keys
  userPendingDeduction: (userId: string) => `billing:user:${userId}:pending`,
  userWatchSession: (userId: string) => `billing:user:${userId}:session`,
  creatorPendingWatchTime: (creatorId: string) =>
    `billing:creator:${creatorId}:watchtime`,
};
