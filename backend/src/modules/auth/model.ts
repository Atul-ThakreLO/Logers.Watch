import { t } from "elysia";

// Login schema
export const LoginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 1 }),
});

// Register schema
export const RegisterSchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 100 }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
});

// Token response schema
export const TokenResponseSchema = t.Object({
  accessToken: t.String(),
  refreshToken: t.String(),
  expiresIn: t.Number(),
});

// JWT Payload interface
export interface JWTPayload {
  sub: string; // user id
  email: string;
  name: string;
  type: "access" | "refresh" | "stream"; // token type
  iat?: number;
  exp?: number;
}

// Stream token payload for signed URLs (DASH streaming)
export interface StreamTokenPayload {
  sub: string; // user id
  videoId: string;
  type: "stream";
  exp: number;
}

// Login DTO
export interface LoginDTO {
  email: string;
  password: string;
}

// Register DTO
export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
}

// Token response
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Refresh token storage (for invalidation)
export interface RefreshTokenData {
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}
