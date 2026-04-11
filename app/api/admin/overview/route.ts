import { NextResponse } from "next/server"
import { requireAdminRoute } from "@/lib/admin/guards"
import { getAdminOverviewSnapshot } from "@/lib/admin/overview"

export const dynamic = "force-dynamic"

export async function GET() {
  const authResult = await requireAdminRoute("admin:view-overview")
  if ("response" in authResult) {
    return authResult.response
  }

  const overview = await getAdminOverviewSnapshot()

  return NextResponse.json(
    { overview },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  )
}