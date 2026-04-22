import type { Session } from "next-auth"
import { describe, expect, it } from "vitest"

import { authConfig } from "@/auth.config"

describe("authConfig.callbacks.authorized", () => {
  const authorized = authConfig.callbacks?.authorized

  if (!authorized) {
    throw new Error("Missing authorized callback")
  }

  function createAuth(user: Session["user"]): Session {
    return {
      user,
      expires: new Date(Date.now() + 60_000).toISOString(),
    }
  }

  function createRequest(pathname: string) {
    return {
      nextUrl: new URL(`https://example.com${pathname}`),
    } as Parameters<typeof authorized>[0]["request"]
  }

  it("allows active authenticated users onto the dashboard", () => {
    expect(
      authorized({
        auth: createAuth({
          id: "user_123",
          role: "user",
          accountStatus: "active",
        }),
        request: createRequest("/dashboard"),
      }),
    ).toBe(true)
  })

  it("blocks suspended users from the dashboard", () => {
    expect(
      authorized({
        auth: createAuth({
          id: "user_123",
          role: "user",
          accountStatus: "suspended",
        }),
        request: createRequest("/dashboard"),
      }),
    ).toBe(false)
  })

  it("always defers admin portal auth to the server-side admin layout", () => {
    expect(
      authorized({
        auth: createAuth({
          id: "user_123",
          role: "user",
          accountStatus: "active",
        }),
        request: createRequest("/admin/customers"),
      }),
    ).toBe(true)
    expect(
      authorized({
        auth: null,
        request: createRequest("/admin/customers"),
      }),
    ).toBe(true)
  })
})