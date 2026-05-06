import { z } from "zod"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import connectDB from "@/lib/db"
import { publishAdminFeedbackEvent } from "@/lib/admin/feedback-events"
import { FEEDBACK_TYPES } from "@/lib/admin/feedback-types"
import { Feedback } from "@/lib/models"

const createFeedbackSchema = z
  .object({
    type: z.enum(FEEDBACK_TYPES),
    message: z.string().trim().min(1).max(4000),
    pathname: z.string().trim().max(512).optional(),
  })
  .strict()

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = createFeedbackSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid feedback submission",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    await connectDB()

    const feedback = await Feedback.create({
      userId: session.user.id,
      type: parsed.data.type,
      message: parsed.data.message,
      pathname: parsed.data.pathname,
      metadata: {
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    publishAdminFeedbackEvent({
      type: "feedback.created",
      data: {
        feedbackId: feedback._id.toString(),
        status: feedback.status,
        feedbackType: feedback.type,
        createdAt: feedback.createdAt.toISOString(),
      },
    })

    return NextResponse.json(
      {
        success: true,
        feedbackId: feedback._id.toString(),
        status: feedback.status,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error creating feedback:", error)
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    )
  }
}
