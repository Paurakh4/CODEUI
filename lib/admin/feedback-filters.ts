import {
  ADMIN_FEEDBACK_PAGE_SIZES,
  ADMIN_FEEDBACK_STATUS_FILTERS,
  type AdminFeedbackPageSize,
  type AdminFeedbackQuery,
  type AdminFeedbackStatusFilter,
} from "@/lib/admin/feedback-types"

function getFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}

function normalizeStatus(value: string | undefined): AdminFeedbackStatusFilter {
  if (!value) {
    return "all"
  }

  const normalized = value.trim().toLowerCase()

  return ADMIN_FEEDBACK_STATUS_FILTERS.includes(normalized as AdminFeedbackStatusFilter)
    ? (normalized as AdminFeedbackStatusFilter)
    : "all"
}

function normalizePageSize(value: string | undefined): AdminFeedbackPageSize {
  const parsed = parsePositiveInt(value, 25)

  return ADMIN_FEEDBACK_PAGE_SIZES.includes(parsed as AdminFeedbackPageSize)
    ? (parsed as AdminFeedbackPageSize)
    : 25
}

export function parseAdminFeedbackQuery(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): AdminFeedbackQuery {
  const statusValue =
    input instanceof URLSearchParams
      ? input.get("status") ?? undefined
      : getFirst(input.status)
  const pageValue =
    input instanceof URLSearchParams ? input.get("page") ?? undefined : getFirst(input.page)
  const pageSizeValue =
    input instanceof URLSearchParams
      ? input.get("pageSize") ?? undefined
      : getFirst(input.pageSize)

  return {
    status: normalizeStatus(statusValue),
    page: parsePositiveInt(pageValue, 1),
    pageSize: normalizePageSize(pageSizeValue),
  }
}