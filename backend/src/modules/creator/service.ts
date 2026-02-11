import { prisma, cache, CacheKeys } from "../../utils/db";
import type {
  CreateCreatorDTO,
  UpdateCreatorDTO,
  CreatorResponse,
} from "./model";
import type { Creator } from "../../generated/prisma/client";

// Cache TTL in seconds (5 minutes)
const CREATOR_CACHE_TTL = 300;

// Helper to strip password from creator object
function toCreatorResponse(creator: Creator): CreatorResponse {
  const { password, ...creatorResponse } = creator;
  return creatorResponse;
}

export class CreatorService {
  /**
   * Create a new creator
   */
  async create(data: CreateCreatorDTO): Promise<CreatorResponse> {
    // Check if email already exists
    const existingCreator = await this.findByEmail(data.email);
    if (existingCreator) {
      throw new Error("Creator with this email already exists");
    }

    // Hash password using Bun's built-in password hashing
    const hashedPassword = await Bun.password.hash(data.password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    const creator = await prisma.creator.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        company: data.company || null,
        password: hashedPassword,
        eoaAddress: data.eoaAddress || null,
      },
    });

    // Cache the new creator
    await cache.set(CacheKeys.creator(creator.id), creator, CREATOR_CACHE_TTL);
    await cache.set(
      CacheKeys.creatorByEmail(creator.email),
      creator,
      CREATOR_CACHE_TTL,
    );

    return toCreatorResponse(creator);
  }

  /**
   * Find creator by ID
   */
  async findById(id: string): Promise<Creator | null> {
    // Try cache first
    const cached = await cache.get<Creator>(CacheKeys.creator(id));
    if (cached) return cached;

    const creator = await prisma.creator.findUnique({
      where: { id },
    });

    if (creator) {
      await cache.set(CacheKeys.creator(id), creator, CREATOR_CACHE_TTL);
    }

    return creator;
  }

  /**
   * Find creator by email
   */
  async findByEmail(email: string): Promise<Creator | null> {
    const normalizedEmail = email.toLowerCase();

    // Try cache first
    const cached = await cache.get<Creator>(
      CacheKeys.creatorByEmail(normalizedEmail),
    );
    if (cached) return cached;

    const creator = await prisma.creator.findUnique({
      where: { email: normalizedEmail },
    });

    if (creator) {
      await cache.set(
        CacheKeys.creatorByEmail(normalizedEmail),
        creator,
        CREATOR_CACHE_TTL,
      );
    }

    return creator;
  }

  /**
   * Get creator response by ID (without password)
   */
  async getById(id: string): Promise<CreatorResponse | null> {
    const creator = await this.findById(id);
    return creator ? toCreatorResponse(creator) : null;
  }

  /**
   * Update creator
   */
  async update(
    id: string,
    data: UpdateCreatorDTO,
  ): Promise<CreatorResponse | null> {
    try {
      const creator = await prisma.creator.update({
        where: { id },
        data,
      });

      // Invalidate and update cache
      await cache.del(CacheKeys.creator(id));
      await cache.del(CacheKeys.creatorByEmail(creator.email));
      await cache.set(CacheKeys.creator(id), creator, CREATOR_CACHE_TTL);
      await cache.set(
        CacheKeys.creatorByEmail(creator.email),
        creator,
        CREATOR_CACHE_TTL,
      );

      return toCreatorResponse(creator);
    } catch {
      return null;
    }
  }

  /**
   * Update creator EOA address
   */
  async updateEoaAddress(
    id: string,
    eoaAddress: string,
  ): Promise<CreatorResponse | null> {
    return this.update(id, { eoaAddress });
  }

  /**
   * Increment watch time for creator
   */
  async incrementWatchTime(
    id: string,
    seconds: number,
  ): Promise<CreatorResponse | null> {
    try {
      const creator = await prisma.creator.update({
        where: { id },
        data: {
          watchTime: { increment: seconds },
        },
      });

      // Invalidate cache
      await cache.del(CacheKeys.creator(id));
      await cache.del(CacheKeys.creatorByEmail(creator.email));

      return toCreatorResponse(creator);
    } catch {
      return null;
    }
  }

  /**
   * Add earnings to creator
   */
  async addEarnings(
    id: string,
    amount: number,
  ): Promise<CreatorResponse | null> {
    try {
      const creator = await prisma.creator.update({
        where: { id },
        data: {
          amountEarned: { increment: amount },
        },
      });

      // Invalidate cache
      await cache.del(CacheKeys.creator(id));
      await cache.del(CacheKeys.creatorByEmail(creator.email));

      return toCreatorResponse(creator);
    } catch {
      return null;
    }
  }

  /**
   * Delete creator
   */
  async delete(id: string): Promise<boolean> {
    try {
      const creator = await prisma.creator.delete({
        where: { id },
      });

      // Invalidate cache
      await cache.del(CacheKeys.creator(id));
      await cache.del(CacheKeys.creatorByEmail(creator.email));

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify password
   */
  async verifyPassword(creator: Creator, password: string): Promise<boolean> {
    return Bun.password.verify(password, creator.password);
  }

  /**
   * Get creator with videos
   */
  async getWithVideos(
    id: string,
  ): Promise<(CreatorResponse & { videos: any[] }) | null> {
    const creator = await prisma.creator.findUnique({
      where: { id },
      include: { videos: true },
    });

    if (!creator) return null;

    const { password, ...creatorResponse } = creator;
    return creatorResponse;
  }
}

export const creatorService = new CreatorService();
