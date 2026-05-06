import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoute } from "@/lib/admin/guards"
import { publishAdminFeedbackEvent } from "@/lib/admin/feedback-events"
import { AdminFeedbackMutationError, updateAdminFeedbackStatus } from "@/lib/admin/feedback"
import { FEEDBACK_STATUSES } from "@/lib/admin/feedback-types"

const updateFeedbackSchema = z
  .object({
    status: z.enum(FEEDBACK_STATUSES),
    adminNote: z.string().trim().max(4000).optional(),
    responseMessage: z.string().trim().max(8000).optional(),
    sendEmail: z.boolean().optional(),
  })
  .strict()
  .refine((value) => !value.sendEmail || value.status === "responded", {
    message: "Email responses can only be sent when marking feedback as responded",
    path: ["sendEmail"],
  })
  .refine((value) => !value.sendEmail || Boolean(value.responseMessage?.trim()), {
    message: "Response message is required when emailing the user",
    path: ["responseMessage"],
  })

export const dynamic = "force-dynamic"

interface FeedbackRouteContext {
  params: Promise<{
    feedbackId: string
  }>
}

export async function PATCH(request: Request, { params }: FeedbackRouteContext) {
  const authResult = await requireAdminRoute("admin:manage-feedback")
  if ("response" in authResult) {
    return authResult.response
  }

  const body = await request.json().catch(() => null)
  const parsed = updateFeedbackSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid feedback update",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  try {
    const { feedbackId } = await params
    const result = await updateAdminFeedbackStatus({
      feedbackId,
      status: parsed.data.status,
      actor: authResult.session.user,
      adminNote: parsed.data.adminNote,
      responseMessage: parsed.data.responseMessage,
      sendEmail: parsed.data.sendEmail,
    })

    if (result.changed) {
      publishAdminFeedbackEvent({
        type: "feedback.updated",
        data: {
          feedbackId: result.feedback.id,
          status: result.feedback.status,
          previousStatus:
            result.previousStatus === result.feedback.status ? undefined : result.previousStatus,
          updatedAt: result.feedback.updatedAt,
        },
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AdminFeedbackMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("ADMIN_FEEDBACK_PATCH_ERROR", error)
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 })
  }
}