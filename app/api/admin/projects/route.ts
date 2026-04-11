import { NextResponse } from "next/server"
import { requireAdminRoute } from "@/lib/admin/guards"
import { parseAdminProjectsQuery } from "@/lib/admin/project-filters"
import { getAdminProjectsPage } from "@/lib/admin/projects"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authResult = await requireAdminRoute("admin:view-projects")
  if ("response" in authResult) {
    return authResult.response
  }

  const filters = parseAdminProjectsQuery(new URL(request.url).searchParams)
  const result = await getAdminProjectsPage(filters)

  return NextResponse.json(
    {
      projects: result.projects,
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