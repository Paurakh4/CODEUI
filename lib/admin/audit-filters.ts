export const ADMIN_AUDIT_PAGE_SIZES = [10, 25, 50] as const

export type AdminAuditPageSize = (typeof ADMIN_AUDIT_PAGE_SIZES)[number]
export type AdminAuditTargetType = "all" | "user" | "project" | "model-policy"

export interface AdminAuditQuery {
  search: string
  targetType: AdminAuditTargetType
  page: number
  pageSize: AdminAuditPageSize
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

function normalizePageSize(value: string | undefined): AdminAuditPageSize {
  const parsed = Number.parseInt(value || "", 10)

  if (ADMIN_AUDIT_PAGE_SIZES.includes(parsed as AdminAuditPageSize)) {
    return parsed as AdminAuditPageSize
  }

  return 25
}

export function parseAdminAuditQuery(
  input: URLSearchParams | Record<string, unknown>,
): AdminAuditQuery {
  const search = (takeString(input, "q") || "").trim()
  const targetTypeValue = takeString(input, "targetType")

  return {
    search,
    targetType:
      targetTypeValue === "user" || targetTypeValue === "project" || targetTypeValue === "model-policy"
        ? targetTypeValue
        : "all",
    page: normalizePositiveInteger(takeString(input, "page"), 1),
    pageSize: normalizePageSize(takeString(input, "pageSize")),
  }
}