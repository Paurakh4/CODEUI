import {
  ACCOUNT_STATUSES,
  USER_ROLES,
  type AccountStatus,
  type UserRole,
} from "@/lib/admin/rbac"
import type { SubscriptionTier } from "@/lib/pricing"

export const ADMIN_USER_PAGE_SIZES = [10, 25, 50] as const

export type AdminUserPageSize = (typeof ADMIN_USER_PAGE_SIZES)[number]

export interface AdminUsersQuery {
  search: string
  role: UserRole | "all"
  accountStatus: AccountStatus | "all"
  tier: SubscriptionTier | "all"
  page: number
  pageSize: AdminUserPageSize
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = ["free", "pro", "proplus"]

function takeString(
  input: URLSearchParams | Record<string, unknown>,
  key: string,
): string | undefined {
  const rawValue = input instanceof URLSearchParams ? input.get(key) : input[key]

  if (Array.isArray(rawValue)) {
    return typeof rawValue[0] === "string" ? rawValue[0] : undefined
  }

  return typeof rawValue === "string" ? rawValue : undefined
}

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizePageSize(value: string | undefined): AdminUserPageSize {
  const parsed = Number.parseInt(value || "", 10)
  if (ADMIN_USER_PAGE_SIZES.includes(parsed as AdminUserPageSize)) {
    return parsed as AdminUserPageSize
  }

  return 25
}

export function parseAdminUsersQuery(
  input: URLSearchParams | Record<string, unknown>,
): AdminUsersQuery {
  const search = (takeString(input, "q") || "").trim()
  const roleValue = takeString(input, "role")
  const statusValue = takeString(input, "status")
  const tierValue = takeString(input, "tier")

  return {
    search,
    role:
      roleValue && USER_ROLES.includes(roleValue as UserRole)
        ? (roleValue as UserRole)
        : "all",
    accountStatus:
      statusValue && ACCOUNT_STATUSES.includes(statusValue as AccountStatus)
        ? (statusValue as AccountStatus)
        : "all",
    tier:
      tierValue && SUBSCRIPTION_TIERS.includes(tierValue as SubscriptionTier)
        ? (tierValue as SubscriptionTier)
        : "all",
    page: normalizePositiveInteger(takeString(input, "page"), 1),
    pageSize: normalizePageSize(takeString(input, "pageSize")),
  }
}