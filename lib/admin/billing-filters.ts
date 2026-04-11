import { ACCOUNT_STATUSES, type AccountStatus } from "@/lib/admin/rbac"
import type { SubscriptionTier } from "@/lib/pricing"

export const ADMIN_BILLING_PAGE_SIZES = [10, 25, 50] as const

export type AdminBillingPageSize = (typeof ADMIN_BILLING_PAGE_SIZES)[number]
export type AdminBillingLinkStatus = "all" | "linked" | "unlinked"

export interface AdminBillingQuery {
  search: string
  tier: SubscriptionTier | "all"
  accountStatus: AccountStatus | "all"
  linkStatus: AdminBillingLinkStatus
  page: number
  pageSize: AdminBillingPageSize
}

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

function normalizePageSize(value: string | undefined): AdminBillingPageSize {
  const parsed = Number.parseInt(value || "", 10)

  if (ADMIN_BILLING_PAGE_SIZES.includes(parsed as AdminBillingPageSize)) {
    return parsed as AdminBillingPageSize
  }

  return 25
}

export function parseAdminBillingQuery(
  input: URLSearchParams | Record<string, unknown>,
): AdminBillingQuery {
  const search = (takeString(input, "q") || "").trim()
  const tierValue = takeString(input, "tier")
  const accountStatusValue = takeString(input, "status")
  const linkStatusValue = takeString(input, "link")

  return {
    search,
    tier:
      tierValue === "free" || tierValue === "pro" || tierValue === "proplus"
        ? tierValue
        : "all",
    accountStatus:
      accountStatusValue && ACCOUNT_STATUSES.includes(accountStatusValue as AccountStatus)
        ? (accountStatusValue as AccountStatus)
        : "all",
    linkStatus:
      linkStatusValue === "linked" || linkStatusValue === "unlinked"
        ? linkStatusValue
        : "all",
    page: normalizePositiveInteger(takeString(input, "page"), 1),
    pageSize: normalizePageSize(takeString(input, "pageSize")),
  }
}