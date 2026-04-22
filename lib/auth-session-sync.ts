import type { JWT } from "next-auth/jwt"

import { resolveAdminAccess } from "@/lib/admin/rbac"
import type { SubscriptionTier } from "@/lib/pricing"

export const USER_SESSION_SYNC_INTERVAL_MS = 60_000

type TokenSnapshot = Pick<
  JWT,
  | "id"
  | "subscription"
  | "role"
  | "accountStatus"
  | "permissions"
  | "monthlyCredits"
  | "topupCredits"
  | "totalCredits"
  | "credits"
  | "userDataSyncedAt"
>

export interface DbUserSessionSnapshot {
  name?: string | null
  email?: string | null
  image?: string | null
  role?: string | null
  accountStatus?: string | null
  permissionOverrides?: readonly string[] | null
  subscription?: {
    tier?: SubscriptionTier | null
  } | null
  monthlyCredits?: number | null
  topupCredits?: number | null
  credits?: number | null
}

function hasCompleteDbBackedSnapshot(token: TokenSnapshot) {
  return (
    typeof token.subscription === "string" &&
    typeof token.role === "string" &&
    typeof token.accountStatus === "string" &&
    Array.isArray(token.permissions) &&
    typeof token.monthlyCredits === "number" &&
    typeof token.topupCredits === "number" &&
    typeof token.totalCredits === "number" &&
    typeof token.credits === "number"
  )
}

export function shouldRefreshDbBackedToken(input: {
  token: TokenSnapshot
  trigger?: string
  now?: number
  intervalMs?: number
}) {
  if (!input.token.id) {
    return false
  }

  if (input.trigger === "update") {
    return true
  }

  if (!hasCompleteDbBackedSnapshot(input.token)) {
    return true
  }

  if (typeof input.token.userDataSyncedAt !== "number") {
    return true
  }

  const now = input.now ?? Date.now()
  const intervalMs = input.intervalMs ?? USER_SESSION_SYNC_INTERVAL_MS

  return now - input.token.userDataSyncedAt >= intervalMs
}

export function applyDbUserSnapshotToToken(input: {
  token: JWT
  user: DbUserSessionSnapshot
  now?: number
}) {
  const { token, user } = input
  const adminAccess = resolveAdminAccess({
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    permissionOverrides: user.permissionOverrides,
  })
  const monthlyCredits = user.monthlyCredits ?? 0
  const topupCredits = user.topupCredits ?? 0

  token.name = user.name ?? token.name
  token.email = user.email ?? token.email
  token.picture = user.image ?? token.picture
  token.subscription = (user.subscription?.tier || "free") as SubscriptionTier
  token.role = adminAccess.role
  token.accountStatus = adminAccess.accountStatus
  token.permissions = adminAccess.permissions
  token.monthlyCredits = monthlyCredits
  token.topupCredits = topupCredits
  token.totalCredits = monthlyCredits + topupCredits
  token.credits = user.credits ?? monthlyCredits + topupCredits
  token.userDataSyncedAt = input.now ?? Date.now()

  return token
}