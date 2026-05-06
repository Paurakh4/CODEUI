import { describe, expect, it } from "vitest"

import { parseAdminFeedbackQuery } from "@/lib/admin/feedback-filters"

describe("UT-22 parseAdminFeedbackQuery", () => {
  it("returns sane defaults", () => {
    expect(parseAdminFeedbackQuery({})).toEqual({
      status: "all",
      page: 1,
      pageSize: 25,
    })
  })

  it("normalizes valid filters and pagination", () => {
    expect(
      parseAdminFeedbackQuery({
        status: "read",
        page: "3",
        pageSize: "50",
      }),
    ).toEqual({
      status: "read",
      page: 3,
      pageSize: 50,
    })
  })

  it("falls back for invalid values", () => {
    expect(
      parseAdminFeedbackQuery({
        status: "closed",
        page: "0",
        pageSize: "999",
      }),
    ).toEqual({
      status: "all",
      page: 1,
      pageSize: 25,
    })
  })
})