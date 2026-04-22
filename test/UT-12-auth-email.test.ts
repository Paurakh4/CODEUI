import { describe, expect, it } from "vitest"

import {
  buildAuthActionUrl,
  hashAuthActionToken,
} from "@/lib/auth-token-utils"

describe("UT-12 auth email helpers", () => {
  it("builds reset-password URLs against the provided base URL", () => {
    expect(
      buildAuthActionUrl("password-reset", "abc123", "https://codeui.example.com/"),
    ).toBe("https://codeui.example.com/auth/reset-password?token=abc123")
  })

  it("builds verify-email URLs against the provided base URL", () => {
    expect(
      buildAuthActionUrl("email-verification", "verify-token", "https://codeui.example.com"),
    ).toBe("https://codeui.example.com/auth/verify-email?token=verify-token")
  })

  it("hashes tokens deterministically without exposing the raw token", () => {
    const hashed = hashAuthActionToken("sensitive-token")

    expect(hashed).toHaveLength(64)
    expect(hashed).not.toContain("sensitive-token")
    expect(hashAuthActionToken("sensitive-token")).toBe(hashed)
  })
})