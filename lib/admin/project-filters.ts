import {
  ACCOUNT_STATUSES,
  USER_ROLES,
  type AccountStatus,
  type UserRole,
} from "@/lib/admin/rbac"

export const ADMIN_PROJECT_PAGE_SIZES = [10, 25, 50] as const

export type AdminProjectPageSize = (typeof ADMIN_PROJECT_PAGE_SIZES)[number]
export type AdminProjectVisibility = "all" | "public" | "private"

export interface AdminProjectsQuery {
  search: string
  visibility: AdminProjectVisibility
  ownerRole: UserRole | "all"
  ownerStatus: AccountStatus | "all"
  page: number
  pageSize: AdminProjectPageSize
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

function normalizePageSize(value: string | undefined): AdminProjectPageSize {
  const parsed = Number.parseInt(value || "", 10)

  if (ADMIN_PROJECT_PAGE_SIZES.includes(parsed as AdminProjectPageSize)) {
    return parsed as AdminProjectPageSize
  }

  return 25
}

export function parseAdminProjectsQuery(
  input: URLSearchParams | Record<string, unknown>,
): AdminProjectsQuery {
  const search = (takeString(input, "q") || "").trim()
  const visibilityValue = takeString(input, "visibility")
  const ownerRoleValue = takeString(input, "ownerRole")
  const ownerStatusValue = takeString(input, "ownerStatus")

  return {
    search,
    visibility:
      visibilityValue === "public" || visibilityValue === "private"
        ? visibilityValue
        : "all",
    ownerRole:
      ownerRoleValue && USER_ROLES.includes(ownerRoleValue as UserRole)
        ? (ownerRoleValue as UserRole)
        : "all",
    ownerStatus:
      ownerStatusValue && ACCOUNT_STATUSES.includes(ownerStatusValue as AccountStatus)
        ? (ownerStatusValue as AccountStatus)
        : "all",
    page: normalizePositiveInteger(takeString(input, "page"), 1),
    pageSize: normalizePageSize(takeString(input, "pageSize")),
  }
}