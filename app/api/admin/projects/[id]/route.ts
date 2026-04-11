import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoute } from "@/lib/admin/guards"
import {
  AdminProjectMutationError,
  deleteAdminProjectById,
  getAdminProjectDetail,
  updateAdminProjectById,
} from "@/lib/admin/projects"

const updateAdminProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    emoji: z.string().trim().min(1).max(16).optional(),
    isPrivate: z.boolean().optional(),
    reason: z.string().trim().min(3).max(200),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).every((key) => key === "reason")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field must change.",
        path: ["reason"],
      })
    }
  })

const deleteAdminProjectSchema = z
  .object({
    reason: z.string().trim().min(3).max(200),
  })
  .strict()

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireAdminRoute("admin:view-projects")
  if ("response" in authResult) {
    return authResult.response
  }

  const { id } = await params
  const detail = await getAdminProjectDetail(id)

  if (!detail) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  return NextResponse.json(
    { project: detail },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  )
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const authResult = await requireAdminRoute("admin:manage-projects")
  if ("response" in authResult) {
    return authResult.response
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateAdminProjectSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid project update",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  try {
    const detail = await updateAdminProjectById({
      projectId: id,
      actor: authResult.session.user,
      changes: parsed.data,
    })

    return NextResponse.json({ project: detail })
  } catch (error) {
    if (error instanceof AdminProjectMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("ADMIN_PROJECT_PATCH_ERROR", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireAdminRoute("admin:manage-projects")
  if ("response" in authResult) {
    return authResult.response
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = deleteAdminProjectSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid project delete request",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  try {
    const result = await deleteAdminProjectById({
      projectId: id,
      actor: authResult.session.user,
      reason: parsed.data.reason,
    })

    return NextResponse.json({ project: result })
  } catch (error) {
    if (error instanceof AdminProjectMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("ADMIN_PROJECT_DELETE_ERROR", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}