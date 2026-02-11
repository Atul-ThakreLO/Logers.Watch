import { t } from "elysia";

// User schema for validation
export const UserSchema = t.Object({
  id: t.String(),
  name: t.String({ minLength: 2, maxLength: 100 }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  balance: t.Number(),
  lastRechargeAmount: t.Number(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

export const CreateUserSchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 100 }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
});

export const UserResponseSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  balance: t.Number(),
  lastRechargeAmount: t.Number(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

// User type definitions
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  balance: number;
  lastRechargeAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  balance: number;
  lastRechargeAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to strip password from user object
export function toUserResponse(user: User): UserResponse {
  const { password, ...userResponse } = user;
  return userResponse;
}
