import { prisma } from "../../utils/db";
import type { CreateUserDTO, UserResponse } from "./model";
import type { User } from "../../generated/prisma/client";

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

    // Check if username already exists
    const existingUsername = await this.findByUsername(data.username);
    if (existingUsername) {
      throw new Error("Username is already taken");
    }

    // Hash password using Bun's built-in password hashing
    const hashedPassword = await Bun.password.hash(data.password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username,
        password: hashedPassword,
      },
    });

    return toUserResponse(user);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { username },
    });
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
    data: Partial<Pick<User, "username" | "email">>,
  ): Promise<UserResponse | null> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data,
      });
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
      await prisma.user.delete({
        where: { id },
      });
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
