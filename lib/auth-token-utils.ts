import { createHash } from "node:crypto";
import { type AuthTokenType } from "@/lib/models/AuthToken";

export const AUTH_TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  "email-verification": 24 * 60 * 60 * 1000,
  "password-reset": 60 * 60 * 1000,
};

export function hashAuthActionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getAuthBaseUrl(): string {
  const baseUrl =
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  return baseUrl.replace(/\/$/, "");
}

export function buildAuthActionUrl(
  type: AuthTokenType,
  token: string,
  baseUrl = getAuthBaseUrl()
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const pathname =
    type === "password-reset" ? "/auth/reset-password" : "/auth/verify-email";

  return `${normalizedBaseUrl}${pathname}?token=${encodeURIComponent(token)}`;
}