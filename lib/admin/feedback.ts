import "server-only"

import connectDB from "@/lib/db"
import { createAdminAuditEntry } from "@/lib/admin/audit"
import { sendFeedbackResponseEmail } from "@/lib/feedback-email"
import type {
  AdminFeedbackListItem,
  AdminFeedbackPageData,
  AdminFeedbackQuery,
  FeedbackEmailDeliveryStatus,
  FeedbackStatus,
} from "@/lib/admin/feedback-types"
import { Feedback, User } from "@/lib/models"
import type { UserRole } from "@/lib/admin/rbac"

interface AdminActor {
  id: string
  email?: string | null
  role: UserRole
}

interface FeedbackRow {
  _id: { toString(): string }
  userId: { toString(): string }
  type: AdminFeedbackListItem["type"]
  status: FeedbackStatus
  message: string
  adminNote?: string
  responseMessage?: string
  responseEmailStatus?: FeedbackEmailDeliveryStatus
  responseEmailSentAt?: Date
  responseEmailError?: string
  responseEmailRecipient?: string
  pathname?: string
  createdAt: Date
  updatedAt: Date
  readAt?: Date
  respondedAt?: Date
}

interface UserRow {
  _id: { toString(): string }
  name?: string
  email?: string
  image?: string
}

export class AdminFeedbackMutationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "AdminFeedbackMutationError"
    this.status = status
  }
}

interface AdminFeedbackEmailDelivery {
  status: FeedbackEmailDeliveryStatus
  errorMessage?: string
}

function normalizeFeedbackText(value: string | null | undefined) {
  return value?.trim() || ""
}

function normalizeResponseEmailStatus(
  value: FeedbackEmailDeliveryStatus | null | undefined,
): FeedbackEmailDeliveryStatus {
  if (value === "sent" || value === "skipped" || value === "failed") {
    return value
  }

  return "not-requested"
}

function createFeedbackPreview(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim()

  if (normalized.length <= 180) {
    return normalized
  }

  return `${normalized.slice(0, 177)}...`
}

function mapFeedbackItem(row: FeedbackRow, userMap: Map<string, UserRow>): AdminFeedbackListItem {
  const userId = row.userId.toString()
  const user = userMap.get(userId)

  return {
    id: row._id.toString(),
    type: row.type,
    status: row.status,
    message: row.message,
    preview: createFeedbackPreview(row.message),
    pathname: row.pathname,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readAt: row.readAt?.toISOString(),
    respondedAt: row.respondedAt?.toISOString(),
    adminNote: normalizeFeedbackText(row.adminNote),
    responseMessage: normalizeFeedbackText(row.responseMessage),
    responseEmail: {
      status: normalizeResponseEmailStatus(row.responseEmailStatus),
      recipient: row.responseEmailRecipient,
      sentAt: row.responseEmailSentAt?.toISOString(),
      errorMessage: row.responseEmailError,
    },
    user: {
      id: userId,
      name: user?.name?.trim() || "Unknown user",
      email: user?.email?.trim() || "unknown@example.com",
      image: user?.image,
    },
  }
}

async function getUserMap(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, UserRow>()
  }

  const users = (await User.find({ _id: { $in: userIds } })
    .select("name email image")
    .lean()) as UserRow[]

  return new Map(users.map((user) => [user._id.toString(), user]))
}

export async function getAdminFeedbackPageData(
  filters: AdminFeedbackQuery,
): Promise<AdminFeedbackPageData> {
  await connectDB()

  const query: Record<string, unknown> = {}

  if (filters.status !== "all") {
    query.status = filters.status
  }

  const offset = (filters.page - 1) * filters.pageSize

  const [feedbackRows, filteredFeedback, totalFeedback, newCount, readCount, respondedCount] =
    await Promise.all([
      Feedback.find(query)
        .select(
          "userId type status message adminNote responseMessage responseEmailStatus responseEmailSentAt responseEmailError responseEmailRecipient pathname createdAt updatedAt readAt respondedAt",
        )
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(filters.pageSize)
        .lean() as Promise<FeedbackRow[]>,
      Feedback.countDocuments(query),
      Feedback.countDocuments({}),
      Feedback.countDocuments({ status: "new" }),
      Feedback.countDocuments({ status: "read" }),
      Feedback.countDocuments({ status: "responded" }),
    ])

  const userMap = await getUserMap(
    Array.from(new Set(feedbackRows.map((feedback) => feedback.userId.toString()))),
  )

  const totalPages = Math.max(1, Math.ceil(filteredFeedback / filters.pageSize))

  return {
    feedback: feedbackRows.map((row) => mapFeedbackItem(row, userMap)),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalFeedback: filteredFeedback,
      totalPages,
      hasPreviousPage: filters.page > 1,
      hasNextPage: filters.page < totalPages,
    },
    summary: {
      totalFeedback,
      unreadCount: newCount,
      newCount,
      readCount,
      respondedCount,
    },
    filters,
  }
}

export async function updateAdminFeedbackStatus(input: {
  feedbackId: string
  status: FeedbackStatus
  actor: AdminActor
  adminNote?: string
  responseMessage?: string
  sendEmail?: boolean
}) {
  await connectDB()

  const currentFeedback = (await Feedback.findById(input.feedbackId)
    .select(
      "userId type status message adminNote responseMessage responseEmailStatus responseEmailSentAt responseEmailError responseEmailRecipient pathname createdAt updatedAt readAt respondedAt readBy respondedBy",
    )
    .lean()) as FeedbackRow & {
    readBy?: { toString(): string }
    respondedBy?: { toString(): string }
  } | null

  if (!currentFeedback) {
    throw new AdminFeedbackMutationError("Feedback not found", 404)
  }

  const currentAdminNote = normalizeFeedbackText(currentFeedback.adminNote)
  const currentResponseMessage = normalizeFeedbackText(currentFeedback.responseMessage)
  const nextAdminNote =
    input.adminNote !== undefined ? input.adminNote.trim() : currentAdminNote
  const nextResponseMessage =
    input.responseMessage !== undefined ? input.responseMessage.trim() : currentResponseMessage
  const statusChanged = currentFeedback.status !== input.status
  const adminNoteChanged = input.adminNote !== undefined && nextAdminNote !== currentAdminNote
  const responseMessageChanged =
    input.responseMessage !== undefined && nextResponseMessage !== currentResponseMessage
  const shouldSendEmail = input.sendEmail === true

  if (shouldSendEmail && input.status !== "responded") {
    throw new AdminFeedbackMutationError(
      "Email responses can only be sent when marking feedback as responded",
      400,
    )
  }

  if (shouldSendEmail && nextResponseMessage.length === 0) {
    throw new AdminFeedbackMutationError(
      "Response message is required when emailing the user",
      400,
    )
  }

  if (!statusChanged && !adminNoteChanged && !responseMessageChanged && !shouldSendEmail) {
    const userMap = await getUserMap([currentFeedback.userId.toString()])

    return {
      changed: false,
      previousStatus: currentFeedback.status,
      feedback: mapFeedbackItem(currentFeedback, userMap),
    }
  }

  const now = new Date()
  const set: Record<string, unknown> = {
    status: input.status,
  }
  const unset: Record<string, 1> = {}
  const emailDelivery: AdminFeedbackEmailDelivery | undefined = undefined

  if (adminNoteChanged) {
    set.adminNote = nextAdminNote
  }

  if (responseMessageChanged) {
    set.responseMessage = nextResponseMessage
  }

  if (statusChanged && input.status === "new") {
    unset.readAt = 1
    unset.readBy = 1
    unset.respondedAt = 1
    unset.respondedBy = 1
  }

  if (statusChanged && input.status === "read") {
    set.readAt = currentFeedback.readAt ?? now
    set.readBy = currentFeedback.readBy?.toString() ?? input.actor.id
    unset.respondedAt = 1
    unset.respondedBy = 1
  }

  if (input.status === "responded" && (statusChanged || shouldSendEmail || responseMessageChanged)) {
    set.readAt = currentFeedback.readAt ?? now
    set.readBy = currentFeedback.readBy?.toString() ?? input.actor.id
    set.respondedAt = now
    set.respondedBy = input.actor.id
  }

  let resolvedEmailDelivery: AdminFeedbackEmailDelivery | undefined

  if (shouldSendEmail) {
    const feedbackUser = (await User.findById(currentFeedback.userId)
      .select("name email")
      .lean()) as Pick<UserRow, "name" | "email"> | null

    if (!feedbackUser?.email?.trim()) {
      throw new AdminFeedbackMutationError("Feedback submitter email was not found", 400)
    }

    try {
      const delivery = await sendFeedbackResponseEmail({
        email: feedbackUser.email.trim(),
        userName: feedbackUser.name,
        feedbackType: currentFeedback.type,
        feedbackMessage: currentFeedback.message,
        responseMessage: nextResponseMessage,
      })

      if (delivery.delivered) {
        set.responseEmailStatus = "sent"
        set.responseEmailRecipient = feedbackUser.email.trim()
        set.responseEmailSentAt = now
        unset.responseEmailError = 1
        resolvedEmailDelivery = { status: "sent" }
      } else {
        const skippedMessage = "SMTP is not configured for outbound feedback replies"
        set.responseEmailStatus = "skipped"
        set.responseEmailRecipient = feedbackUser.email.trim()
        unset.responseEmailSentAt = 1
        set.responseEmailError = skippedMessage
        resolvedEmailDelivery = {
          status: "skipped",
          errorMessage: skippedMessage,
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send feedback reply email"
      set.responseEmailStatus = "failed"
      set.responseEmailRecipient = feedbackUser.email.trim()
      unset.responseEmailSentAt = 1
      set.responseEmailError = message
      resolvedEmailDelivery = {
        status: "failed",
        errorMessage: message,
      }
    }
  }

  const updatedFeedback = (await Feedback.findByIdAndUpdate(
    input.feedbackId,
    {
      $set: set,
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
    },
    { new: true },
  )
    .select(
      "userId type status message adminNote responseMessage responseEmailStatus responseEmailSentAt responseEmailError responseEmailRecipient pathname createdAt updatedAt readAt respondedAt",
    )
    .lean()) as FeedbackRow | null

  if (!updatedFeedback) {
    throw new AdminFeedbackMutationError("Feedback not found", 404)
  }

  const changeSummary: string[] = []

  if (statusChanged) {
    changeSummary.push(`Status set to ${input.status}`)
  }

  if (adminNoteChanged) {
    changeSummary.push("Internal note updated")
  }

  if (responseMessageChanged) {
    changeSummary.push("Response message updated")
  }

  if (resolvedEmailDelivery) {
    changeSummary.push(`Reply email ${resolvedEmailDelivery.status}`)
  }

  await createAdminAuditEntry({
    actorUserId: input.actor.id,
    actorEmail: input.actor.email || "unknown-admin@example.com",
    actorRole: input.actor.role,
    action: "admin.feedback.updated",
    permission: "admin:manage-feedback",
    targetType: "feedback",
    targetId: input.feedbackId,
    reason: changeSummary.join("; "),
    before: {
      status: currentFeedback.status,
      adminNote: currentAdminNote,
      responseMessage: currentResponseMessage,
      responseEmailStatus: normalizeResponseEmailStatus(currentFeedback.responseEmailStatus),
      readAt: currentFeedback.readAt?.toISOString(),
      respondedAt: currentFeedback.respondedAt?.toISOString(),
    },
    after: {
      status: updatedFeedback.status,
      adminNote: normalizeFeedbackText(updatedFeedback.adminNote),
      responseMessage: normalizeFeedbackText(updatedFeedback.responseMessage),
      responseEmailStatus: normalizeResponseEmailStatus(updatedFeedback.responseEmailStatus),
      readAt: updatedFeedback.readAt?.toISOString(),
      respondedAt: updatedFeedback.respondedAt?.toISOString(),
    },
    metadata: {
      emailDelivery: resolvedEmailDelivery,
    },
  })

  const userMap = await getUserMap([updatedFeedback.userId.toString()])

  return {
    changed: true,
    previousStatus: currentFeedback.status,
    feedback: mapFeedbackItem(updatedFeedback, userMap),
    emailDelivery: resolvedEmailDelivery,
  }
}