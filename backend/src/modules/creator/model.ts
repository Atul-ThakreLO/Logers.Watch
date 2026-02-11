import { t } from "elysia";

// Creator schema for validation
export const CreatorSchema = t.Object({
  id: t.String(),
  name: t.String({ minLength: 2, maxLength: 100 }),
  email: t.String({ format: "email" }),
  company: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
  password: t.String({ minLength: 6 }),
  watchTime: t.Number(),
  amountEarned: t.Number(),
  eoaAddress: t.Optional(t.Nullable(t.String())),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

export const CreateCreatorSchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 100 }),
  email: t.String({ format: "email" }),
  company: t.Optional(t.String({ maxLength: 200 })),
  password: t.String({ minLength: 6 }),
  eoaAddress: t.Optional(t.String()),
});

export const UpdateCreatorSchema = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
  company: t.Optional(t.String({ maxLength: 200 })),
  eoaAddress: t.Optional(t.String()),
});

export const CreatorResponseSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  company: t.Nullable(t.String()),
  watchTime: t.Number(),
  amountEarned: t.Number(),
  eoaAddress: t.Nullable(t.String()),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

export const CreatorLoginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 1 }),
});

// Creator type definitions
export interface Creator {
  id: string;
  name: string;
  email: string;
  company: string | null;
  password: string;
  watchTime: number;
  amountEarned: number;
  eoaAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCreatorDTO {
  name: string;
  email: string;
  company?: string;
  password: string;
  eoaAddress?: string;
}

export interface UpdateCreatorDTO {
  name?: string;
  company?: string;
  eoaAddress?: string;
}

export interface CreatorResponse {
  id: string;
  name: string;
  email: string;
  company: string | null;
  watchTime: number;
  amountEarned: number;
  eoaAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to strip password from creator object
export function toCreatorResponse(creator: Creator): CreatorResponse {
  const { password, ...creatorResponse } = creator;
  return creatorResponse;
}
