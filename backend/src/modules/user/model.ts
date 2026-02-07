import { t } from "elysia";

// User schema for validation
export const UserSchema = t.Object({
  id: t.String(),
  email: t.String({ format: "email" }),
  username: t.String({ minLength: 3, maxLength: 50 }),
  password: t.String({ minLength: 6 }),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

export const CreateUserSchema = t.Object({
  email: t.String({ format: "email" }),
  username: t.String({ minLength: 3, maxLength: 50 }),
  password: t.String({ minLength: 6 }),
});

export const UserResponseSchema = t.Object({
  id: t.String(),
  email: t.String(),
  username: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

// User type definitions
export interface User {
  id: string;
  email: string;
  username: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  username: string;
  password: string;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to strip password from user object
export function toUserResponse(user: User): UserResponse {
  const { password, ...userResponse } = user;
  return userResponse;
}
