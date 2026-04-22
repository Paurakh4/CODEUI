import { describe, expect, it } from "vitest"

import {
  deriveNameFromEmail,
  hashPassword,
  normalizeAuthEmail,
  verifyPassword,
} from "@/lib/local-auth"

describe("UT-04 local auth helpers", () => {
  it("normalizes auth emails consistently", () => {
    expect(normalizeAuthEmail("  Test.User@Example.COM ")).toBe("test.user@example.com")
  })

  it("derives a stable fallback display name from the email address", () => {
    expect(deriveNameFromEmail("jane.doe-smith@example.com")).toBe("Jane Doe Smith")
  })

  it("hashes and verifies passwords", async () => {
    const password = "super-secret-password"
    const passwordHash = await hashPassword(password)

    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true)
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false)
  })

  it("rejects malformed stored password hashes", async () => {
    await expect(verifyPassword("password", "bad-format")).resolves.toBe(false)
  })
})