import { NextResponse } from "next/server"
import { requireAdminRoute } from "@/lib/admin/guards"
import { parseAdminUsersQuery } from "@/lib/admin/user-filters"
import { getAdminUsersPage } from "@/lib/admin/users"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authResult = await requireAdminRoute("admin:view-customers")
  if ("response" in authResult) {
    return authResult.response
  }

  const filters = parseAdminUsersQuery(new URL(request.url).searchParams)
  const result = await getAdminUsersPage(filters)

  return NextResponse.json(
    {
      users: result.users,
      pagination: result.pagination,
      summary: result.summary,
      filters: result.filters,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  )
}