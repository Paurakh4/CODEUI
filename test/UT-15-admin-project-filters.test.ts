import { describe, expect, it } from "vitest"

import { parseAdminProjectsQuery } from "@/lib/admin/project-filters"

describe("UT-15 parseAdminProjectsQuery", () => {
  it("returns sane defaults", () => {
    expect(parseAdminProjectsQuery({})).toEqual({
      search: "",
      visibility: "all",
      ownerRole: "all",
      ownerStatus: "all",
      page: 1,
      pageSize: 25,
    })
  })

  it("normalizes filters and pagination", () => {
    expect(
      parseAdminProjectsQuery({
        q: " landing ",
        visibility: "private",
        ownerRole: "moderator",
        ownerStatus: "suspended",
        page: "3",
        pageSize: "50",
      }),
    ).toEqual({
      search: "landing",
      visibility: "private",
      ownerRole: "moderator",
      ownerStatus: "suspended",
      page: 3,
      pageSize: 50,
    })
  })

  it("falls back for invalid values", () => {
    expect(
      parseAdminProjectsQuery({
        visibility: "team",
        ownerRole: "invalid",
        ownerStatus: "offline",
        page: "0",
        pageSize: "999",
      }),
    ).toEqual({
      search: "",
      visibility: "all",
      ownerRole: "all",
      ownerStatus: "all",
      page: 1,
      pageSize: 25,
    })
  })
})