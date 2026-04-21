import { createHash } from "node:crypto"
import { z } from "zod"

export const DISCOVER_SORT_OPTIONS = ["newest", "updated", "most-viewed", "most-liked"] as const

export type DiscoverSortOption = (typeof DISCOVER_SORT_OPTIONS)[number]

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

export function getDiscoverSortStage(sort: DiscoverSortOption) {
  switch (sort) {
    case "updated":
      return { updatedAt: -1 as const }
    case "most-viewed":
      return { views: -1 as const, updatedAt: -1 as const }
    case "most-liked":
      return { likes: -1 as const, updatedAt: -1 as const }
    case "newest":
    default:
      return { createdAt: -1 as const }
  }
}

export function getViewWindowKey(date = new Date()) {
  return date.toISOString().slice(0, 13)
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
