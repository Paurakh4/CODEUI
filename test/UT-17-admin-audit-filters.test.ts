import { describe, expect, it } from "vitest"

import { parseAdminAuditQuery } from "@/lib/admin/audit-filters"

describe("UT-17 parseAdminAuditQuery", () => {
  it("returns sane defaults", () => {
    expect(parseAdminAuditQuery({})).toEqual({
      search: "",
      targetType: "all",
      page: 1,
      pageSize: 25,
    })
  })

  it("normalizes filters and pagination", () => {
    expect(
      parseAdminAuditQuery({
        q: " billing ",
        targetType: "project",
        page: "4",
        pageSize: "50",
      }),
    ).toEqual({
      search: "billing",
      targetType: "project",
      page: 4,
      pageSize: 50,
    })
  })

  it("falls back for invalid values", () => {
    expect(
      parseAdminAuditQuery({
        targetType: "workspace",
        page: "-1",
        pageSize: "999",
      }),
    ).toEqual({
      search: "",
      targetType: "all",
      page: 1,
      pageSize: 25,
    })
  })
})