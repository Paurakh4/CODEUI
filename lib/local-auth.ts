import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { resolveAdminAccess } from "@/lib/admin/rbac";
import { getMonthlyCreditsForTier } from "@/lib/pricing";
import { createDefaultUserPreferences } from "@/lib/user-preferences";

const scrypt = promisify(scryptCallback);
const HASH_PREFIX = "scrypt";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function deriveNameFromEmail(email: string): string {
  const localPart = normalizeAuthEmail(email).split("@")[0] || "user";
  const segments = localPart.split(/[._-]+/).filter(Boolean);
  const normalizedSegments = segments.length > 0 ? segments : ["user"];

  return normalizedSegments
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function createLocalProviderId(): string {
  return `local:${randomUUID()}`;
}

function getNextCreditsResetDate(referenceDate = new Date()): Date {
  const nextResetDate = new Date(referenceDate);
  nextResetDate.setMonth(nextResetDate.getMonth() + 1);
  nextResetDate.setDate(1);
  nextResetDate.setHours(0, 0, 0, 0);
  return nextResetDate;
}

export function buildUserCreationInput(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  googleId?: string | null;
  passwordHash?: string | null;
  defaultModelId: string;
}) {
  const normalizedEmail = normalizeAuthEmail(input.email);
  const adminAccess = resolveAdminAccess({ email: normalizedEmail });
  const initialCredits = getMonthlyCreditsForTier("free");

  return {
    email: normalizedEmail,
    name: input.name?.trim() || deriveNameFromEmail(normalizedEmail),
    image: input.image || undefined,
    googleId: input.googleId?.trim() || createLocalProviderId(),
    passwordHash: input.passwordHash || undefined,
    preferences: createDefaultUserPreferences({
      defaultModel: input.defaultModelId,
    }),
    role: adminAccess.role,
    accountStatus: adminAccess.accountStatus,
    permissionOverrides: [],
    subscription: {
      tier: "free" as const,
    },
    monthlyCredits: initialCredits,
    topupCredits: 20,
    creditsResetDate: getNextCreditsResetDate(),
    totalCreditsUsed: 0,
    credits: initialCredits,
    creditsUsedThisMonth: 0,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `${HASH_PREFIX}$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash?: string | null
): Promise<boolean> {
  if (!storedHash) {
    return false;
  }

  const [prefix, salt, expectedHex] = storedHash.split("$");

  if (prefix !== HASH_PREFIX || !salt || !expectedHex) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const derivedKey = (await scrypt(password, salt, expected.length)) as Buffer;

  if (expected.length === 0 || expected.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(expected, derivedKey);
}