import { NextResponse } from "next/server"
import { requireAdminRoute } from "@/lib/admin/guards"
import { parseAdminFeedbackQuery } from "@/lib/admin/feedback-filters"
import { getAdminFeedbackPageData } from "@/lib/admin/feedback"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authResult = await requireAdminRoute("admin:view-feedback")
  if ("response" in authResult) {
    return authResult.response
  }

  const filters = parseAdminFeedbackQuery(new URL(request.url).searchParams)
  const data = await getAdminFeedbackPageData(filters)

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  })
}