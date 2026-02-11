import { prisma, cache, CacheKeys } from "../../utils/db";
import type { CreateUserDTO, UserResponse } from "./model";
import type { User } from "../../generated/prisma/client";

// Cache TTL in seconds (5 minutes)
const USER_CACHE_TTL = 300;

// Helper to strip password from user object
function toUserResponse(user: User): UserResponse {
  const { password, ...userResponse } = user;
  return userResponse;
}

export class UserService {
  /**
   * Create a new user
   */
  async create(data: CreateUserDTO): Promise<UserResponse> {
    // Check if email already exists
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password using Bun's built-in password hashing
    const hashedPassword = await Bun.password.hash(data.password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: hashedPassword,
      },
    });

    // Cache the new user
    await cache.set(CacheKeys.user(user.id), user, USER_CACHE_TTL);
    await cache.set(CacheKeys.userByEmail(user.email), user, USER_CACHE_TTL);

    return toUserResponse(user);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    // Try cache first
    const cached = await cache.get<User>(CacheKeys.user(id));
    if (cached) return cached;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (user) {
      await cache.set(CacheKeys.user(id), user, USER_CACHE_TTL);
    }

    return user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase();

    // Try cache first
    const cached = await cache.get<User>(
      CacheKeys.userByEmail(normalizedEmail),
    );
    if (cached) return cached;

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      await cache.set(
        CacheKeys.userByEmail(normalizedEmail),
        user,
        USER_CACHE_TTL,
      );
    }

    return user;
  }

  /**
   * Get user response by ID (without password)
   */
  async getById(id: string): Promise<UserResponse | null> {
    const user = await this.findById(id);
    return user ? toUserResponse(user) : null;
  }

  /**
   * Update user
   */
  async update(
    id: string,
    data: Partial<Pick<User, "name" | "email">>,
  ): Promise<UserResponse | null> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data,
      });

      // Invalidate and update cache
      await cache.del(CacheKeys.user(id));
      await cache.del(CacheKeys.userByEmail(user.email));
      await cache.set(CacheKeys.user(id), user, USER_CACHE_TTL);
      await cache.set(CacheKeys.userByEmail(user.email), user, USER_CACHE_TTL);

      return toUserResponse(user);
    } catch {
      return null;
    }
  }

  /**
   * Update user balance
   */
  async updateBalance(
    id: string,
    amount: number,
    isRecharge: boolean = false,
  ): Promise<UserResponse | null> {
    try {
      const updateData: { balance: number; lastRechargeAmount?: number } = {
        balance: amount,
      };

      if (isRecharge) {
        updateData.lastRechargeAmount = amount;
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          balance: { increment: amount },
          ...(isRecharge ? { lastRechargeAmount: amount } : {}),
        },
      });

      // Invalidate cache
      await cache.del(CacheKeys.user(id));
      await cache.del(CacheKeys.userByEmail(user.email));

      return toUserResponse(user);
    } catch {
      return null;
    }
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<boolean> {
    try {
      const user = await prisma.user.delete({
        where: { id },
      });

      // Invalidate cache
      await cache.del(CacheKeys.user(id));
      await cache.del(CacheKeys.userByEmail(user.email));

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify password
   */
  async verifyPassword(user: User, password: string): Promise<boolean> {
    return Bun.password.verify(password, user.password);
  }
}

export const userService = new UserService();
