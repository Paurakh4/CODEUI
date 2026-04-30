import { createHash } from "node:crypto"
import { z } from "zod"

export const DISCOVER_SORT_OPTIONS = ["newest", "updated", "most-viewed", "most-liked"] as const

export type DiscoverSortOption = (typeof DISCOVER_SORT_OPTIONS)[number]
type DiscoverSortStage = Record<string, -1>

const discoverQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12),
  search: z.string().trim().max(100).default(""),
  sort: z.enum(DISCOVER_SORT_OPTIONS).default("newest"),
})

export function parseDiscoverQuery(source: Record<string, string | string[] | undefined>) {
  const normalized = {
    page: Array.isArray(source.page) ? source.page[0] : source.page,
    pageSize: Array.isArray(source.pageSize) ? source.pageSize[0] : source.pageSize,
    search: Array.isArray(source.search) ? source.search[0] : source.search,
    sort: Array.isArray(source.sort) ? source.sort[0] : source.sort,
  }

  return discoverQuerySchema.parse(normalized)
}

export function getDiscoverSortStage(sort: DiscoverSortOption): DiscoverSortStage {
  switch (sort) {
    case "updated":
      return { updatedAt: -1 }
    case "most-viewed":
      return { views: -1, updatedAt: -1 }
    case "most-liked":
      return { likes: -1, updatedAt: -1 }
    case "newest":
    default:
      return { createdAt: -1 }
  }
}

export function getViewWindowKey(date = new Date()) {
  return date.toISOString().slice(0, 13)
}

function deriveDisplayNameFromEmail(email: string): string {
  const localPart = email.trim().toLowerCase().split("@")[0] || "user"
  const segments = localPart.split(/[._-]+/).filter(Boolean)
  const normalizedSegments = segments.length > 0 ? segments : ["user"]

  return normalizedSegments
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export function getPublicOwnerName(input?: { name?: string | null; email?: string | null } | null) {
  const trimmedName = input?.name?.trim()
  if (!trimmedName) {
    return "Anonymous"
  }

  const normalizedEmail = input?.email?.trim().toLowerCase()
  const isAutoDerivedFromEmail = normalizedEmail
    ? trimmedName.toLowerCase() === deriveDisplayNameFromEmail(normalizedEmail).toLowerCase()
    : false
  const looksLikeLocalAutomationName = /^copilot\s+local\b/i.test(trimmedName)

  if (isAutoDerivedFromEmail || looksLikeLocalAutomationName) {
    return "CodeUI Community"
  }

  return trimmedName
}

export function buildViewerFingerprint(input: {
  ipAddress?: string | null
  userAgent?: string | null
  acceptLanguage?: string | null
}) {
  const raw = [input.ipAddress, input.userAgent, input.acceptLanguage]
    .map((value) => (value || "unknown").trim().toLowerCase())
    .join("|")

  return createHash("sha256").update(raw).digest("hex")
}
