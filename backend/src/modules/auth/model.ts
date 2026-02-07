import { t } from "elysia";

// Login schema
export const LoginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 1 }),
});

// Register schema
export const RegisterSchema = t.Object({
  email: t.String({ format: "email" }),
  username: t.String({ minLength: 3, maxLength: 50 }),
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
  username: string;
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
  email: string;
  username: string;
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
