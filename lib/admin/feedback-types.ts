export const FEEDBACK_TYPES = ["bug", "feature", "general"] as const

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const FEEDBACK_STATUSES = ["new", "read", "responded"] as const

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export const FEEDBACK_EMAIL_DELIVERY_STATUSES = [
  "not-requested",
  "sent",
  "skipped",
  "failed",
] as const

export type FeedbackEmailDeliveryStatus = (typeof FEEDBACK_EMAIL_DELIVERY_STATUSES)[number]

export const ADMIN_FEEDBACK_STATUS_FILTERS = ["all", ...FEEDBACK_STATUSES] as const

export type AdminFeedbackStatusFilter = (typeof ADMIN_FEEDBACK_STATUS_FILTERS)[number]

export const ADMIN_FEEDBACK_PAGE_SIZES = [10, 25, 50] as const

export type AdminFeedbackPageSize = (typeof ADMIN_FEEDBACK_PAGE_SIZES)[number]

export interface AdminFeedbackQuery {
  status: AdminFeedbackStatusFilter
  page: number
  pageSize: AdminFeedbackPageSize
}

export interface AdminFeedbackListItem {
  id: string
  type: FeedbackType
  status: FeedbackStatus
  message: string
  preview: string
  pathname?: string
  createdAt: string
  updatedAt: string
  readAt?: string
  respondedAt?: string
  adminNote: string
  responseMessage: string
  responseEmail: {
    status: FeedbackEmailDeliveryStatus
    recipient?: string
    sentAt?: string
    errorMessage?: string
  }
  user: {
    id: string
    name: string
    email: string
    image?: string
  }
}

export interface AdminFeedbackPageData {
  feedback: AdminFeedbackListItem[]
  pagination: {
    page: number
    pageSize: number
    totalFeedback: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  summary: {
    totalFeedback: number
    unreadCount: number
    newCount: number
    readCount: number
    respondedCount: number
  }
  filters: AdminFeedbackQuery
}

export type AdminFeedbackStreamEvent =
  | {
      type: "feedback.created"
      data: {
        feedbackId: string
        status: FeedbackStatus
        feedbackType: FeedbackType
        createdAt: string
      }
    }
  | {
      type: "feedback.updated"
      data: {
        feedbackId: string
        status: FeedbackStatus
        previousStatus?: FeedbackStatus
        updatedAt: string
      }
    }