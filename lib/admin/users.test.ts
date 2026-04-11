import { describe, expect, it } from "vitest"

import { parseAdminUsersQuery } from "@/lib/admin/user-filters"

describe("parseAdminUsersQuery", () => {
  it("returns sane defaults", () => {
    expect(parseAdminUsersQuery({})).toEqual({
      search: "",
      role: "all",
      accountStatus: "all",
      tier: "all",
      page: 1,
      pageSize: 25,
    })
  })

  it("normalizes filters and pagination", () => {
    expect(
      parseAdminUsersQuery({
        q: "  alice ",
        role: "admin",
        status: "suspended",
        tier: "pro",
        page: "3",
        pageSize: "50",
      }),
    ).toEqual({
      search: "alice",
      role: "admin",
      accountStatus: "suspended",
      tier: "pro",
      page: 3,
      pageSize: 50,
    })
  })

  it("falls back for invalid values", () => {
    expect(
      parseAdminUsersQuery({
        role: "not-a-role",
        status: "invalid",
        tier: "business",
        page: "0",
        pageSize: "999",
      }),
    ).toEqual({
      search: "",
      role: "all",
      accountStatus: "all",
      tier: "all",
      page: 1,
      pageSize: 25,
    })
  })
})