import { describe, expect, it } from "vitest"
import {
  buildViewerFingerprint,
  getDiscoverSortStage,
  getViewWindowKey,
  parseDiscoverQuery,
} from "@/lib/discover-projects"

describe("discover project helpers", () => {
  it("returns sane defaults for missing query params", () => {
    expect(parseDiscoverQuery({})).toEqual({
      page: 1,
      pageSize: 12,
      search: "",
      sort: "newest",
    })
  })

  it("parses valid query params", () => {
    expect(
      parseDiscoverQuery({
        page: "3",
        pageSize: "24",
        search: "portfolio",
        sort: "most-liked",
      }),
    ).toEqual({
      page: 3,
      pageSize: 24,
      search: "portfolio",
      sort: "most-liked",
    })
  })

  it("builds the correct sort stage", () => {
    expect(getDiscoverSortStage("most-viewed")).toEqual({ views: -1, updatedAt: -1 })
    expect(getDiscoverSortStage("updated")).toEqual({ updatedAt: -1 })
  })

  it("creates a stable viewer fingerprint", () => {
    const first = buildViewerFingerprint({
      ipAddress: "127.0.0.1",
      userAgent: "Browser",
      acceptLanguage: "en-US",
    })
    const second = buildViewerFingerprint({
      ipAddress: "127.0.0.1",
      userAgent: "Browser",
      acceptLanguage: "en-US",
    })

    expect(first).toBe(second)
  })

  it("changes the fingerprint when the input changes", () => {
    const first = buildViewerFingerprint({
      ipAddress: "127.0.0.1",
      userAgent: "Browser",
      acceptLanguage: "en-US",
    })
    const second = buildViewerFingerprint({
      ipAddress: "127.0.0.2",
      userAgent: "Browser",
      acceptLanguage: "en-US",
    })

    expect(first).not.toBe(second)
  })

  it("returns an hourly view bucket key", () => {
    expect(getViewWindowKey(new Date("2026-04-21T13:42:10.000Z"))).toBe("2026-04-21T13")
  })
})
