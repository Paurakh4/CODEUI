import { describe, expect, it } from "vitest"

import { parseAdminBillingQuery } from "@/lib/admin/billing-filters"

describe("UT-14 parseAdminBillingQuery", () => {
  it("returns sane defaults", () => {
    expect(parseAdminBillingQuery({})).toEqual({
      search: "",
      tier: "all",
      accountStatus: "all",
      linkStatus: "all",
      page: 1,
      pageSize: 25,
    })
  })

  it("normalizes filters and pagination", () => {
    expect(
      parseAdminBillingQuery({
        q: " alice ",
        tier: "pro",
        status: "suspended",
        link: "linked",
        page: "2",
        pageSize: "50",
      }),
    ).toEqual({
      search: "alice",
      tier: "pro",
      accountStatus: "suspended",
      linkStatus: "linked",
      page: 2,
      pageSize: 50,
    })
  })

  it("falls back for invalid values", () => {
    expect(
      parseAdminBillingQuery({
        tier: "business",
        status: "offline",
        link: "maybe",
        page: "0",
        pageSize: "999",
      }),
    ).toEqual({
      search: "",
      tier: "all",
      accountStatus: "all",
      linkStatus: "all",
      page: 1,
      pageSize: 25,
    })
  })
})