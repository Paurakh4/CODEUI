import { describe, expect, it } from "vitest"

import {
  USER_SESSION_SYNC_INTERVAL_MS,
  applyDbUserSnapshotToToken,
  shouldRefreshDbBackedToken,
} from "@/lib/auth-session-sync"

describe("shouldRefreshDbBackedToken", () => {
  it("refreshes when the token is missing database-backed user fields", () => {
    expect(
      shouldRefreshDbBackedToken({
        token: {
          id: "user_123",
          subscription: "pro",
        },
      }),
    ).toBe(true)
  })

  it("refreshes when the caller explicitly requests a session update", () => {
    expect(
      shouldRefreshDbBackedToken({
        token: {
          id: "user_123",
          subscription: "pro",
          role: "admin",
          accountStatus: "active",
          permissions: ["admin:view-overview"],
          monthlyCredits: 120,
          topupCredits: 30,
          totalCredits: 150,
          credits: 150,
          userDataSyncedAt: 1_000,
        },
        trigger: "update",
        now: 1_500,
      }),
    ).toBe(true)
  })

  it("does not refresh while the cached user snapshot is still fresh", () => {
    expect(
      shouldRefreshDbBackedToken({
        token: {
          id: "user_123",
          subscription: "pro",
          role: "admin",
          accountStatus: "active",
          permissions: ["admin:view-overview"],
          monthlyCredits: 120,
          topupCredits: 30,
          totalCredits: 150,
          credits: 150,
          userDataSyncedAt: 10_000,
        },
        now: 10_000 + USER_SESSION_SYNC_INTERVAL_MS - 1,
      }),
    ).toBe(false)
  })

  it("refreshes once the cached user snapshot is stale", () => {
    expect(
      shouldRefreshDbBackedToken({
        token: {
          id: "user_123",
          subscription: "pro",
          role: "admin",
          accountStatus: "active",
          permissions: ["admin:view-overview"],
          monthlyCredits: 120,
          topupCredits: 30,
          totalCredits: 150,
          credits: 150,
          userDataSyncedAt: 10_000,
        },
        now: 10_000 + USER_SESSION_SYNC_INTERVAL_MS,
      }),
    ).toBe(true)
  })
})

describe("applyDbUserSnapshotToToken", () => {
  it("maps MongoDB-backed user fields into the session token", () => {
    const token = applyDbUserSnapshotToToken({
      token: {
        id: "user_123",
      },
      user: {
        name: "Alice Admin",
        email: "alice@example.com",
        image: "https://example.com/alice.png",
        role: "support",
        accountStatus: "suspended",
        permissionOverrides: ["admin:view-models"],
        subscription: {
          tier: "proplus",
        },
        monthlyCredits: 350,
        topupCredits: 25,
        credits: 500,
      },
      now: 42_000,
    })

    expect(token.name).toBe("Alice Admin")
    expect(token.email).toBe("alice@example.com")
    expect(token.picture).toBe("https://example.com/alice.png")
    expect(token.subscription).toBe("proplus")
    expect(token.role).toBe("support")
    expect(token.accountStatus).toBe("suspended")
    expect(token.permissions).toContain("admin:view-overview")
    expect(token.permissions).toContain("admin:view-models")
    expect(token.monthlyCredits).toBe(350)
    expect(token.topupCredits).toBe(25)
    expect(token.totalCredits).toBe(375)
    expect(token.credits).toBe(500)
    expect(token.userDataSyncedAt).toBe(42_000)
  })
})