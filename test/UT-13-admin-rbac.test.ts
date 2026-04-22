import { afterEach, describe, expect, it } from "vitest"

import {
  canAccessAdminPortal,
  getPermissionsForRole,
  hasAdminPermission,
  resolveAdminAccess,
  resolveUserRole,
} from "@/lib/admin/rbac"

const originalAdminEmails = process.env.ADMIN_EMAILS
const originalStaffCredits = process.env.STAFF_CREDITS

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails
  process.env.STAFF_CREDITS = originalStaffCredits
})

describe("UT-13 admin rbac helpers", () => {
  it("promotes env admins to owner when no explicit role exists", () => {
    process.env.ADMIN_EMAILS = "owner@example.com"

    expect(resolveUserRole(undefined, "owner@example.com")).toBe("owner")
  })

  it("promotes env staff to support when no explicit role exists", () => {
    process.env.STAFF_CREDITS = "staff@example.com:500"

    expect(resolveUserRole(undefined, "staff@example.com")).toBe("support")
  })

  it("keeps explicit elevated roles over env fallbacks", () => {
    process.env.ADMIN_EMAILS = "owner@example.com"

    expect(resolveUserRole("moderator", "owner@example.com")).toBe("moderator")
  })

  it("merges permission overrides into resolved access", () => {
    const access = resolveAdminAccess({
      role: "support",
      permissionOverrides: ["admin:view-models"],
    })

    expect(access.permissions).toContain("admin:view-overview")
    expect(access.permissions).toContain("admin:view-models")
  })

  it("exposes admin portal access for internal roles", () => {
    expect(canAccessAdminPortal("support")).toBe(true)
    expect(canAccessAdminPortal("user")).toBe(false)
  })

  it("checks permissions using role defaults", () => {
    const permissions = getPermissionsForRole("finance")

    expect(
      hasAdminPermission({
        role: "finance",
        permission: "admin:view-billing",
        resolvedPermissions: permissions,
      }),
    ).toBe(true)
    expect(
      hasAdminPermission({
        role: "finance",
        permission: "admin:manage-models",
        resolvedPermissions: permissions,
      }),
    ).toBe(false)
  })
})