import "server-only"

import { sendTransactionalEmail } from "@/lib/email"
import type { FeedbackType } from "@/lib/admin/feedback-types"

const feedbackTypeLabels: Record<FeedbackType, string> = {
  bug: "bug report",
  feature: "feature request",
  general: "feedback",
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function trimForEmailPreview(value: string, maxLength = 320) {
  const normalized = value.replace(/\s+/g, " ").trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 3)}...`
}

export async function sendFeedbackResponseEmail(input: {
  email: string
  userName?: string
  feedbackType: FeedbackType
  feedbackMessage: string
  responseMessage: string
}) {
  const typeLabel = feedbackTypeLabels[input.feedbackType]
  const greeting = input.userName?.trim() ? `Hi ${input.userName.trim()},` : "Hi,"
  const feedbackPreview = trimForEmailPreview(input.feedbackMessage)
  const responseMessage = input.responseMessage.trim()

  return sendTransactionalEmail({
    logLabel: "FEEDBACK_REPLY",
    to: input.email,
    subject: `Reply to your CodeUI ${typeLabel}`,
    text: [
      greeting,
      "",
      `Thanks for sending us your ${typeLabel}. Our admin team reviewed it and sent the response below.`,
      "",
      responseMessage,
      "",
      "Original submission:",
      feedbackPreview,
      "",
      "Thanks for helping improve CodeUI.",
    ].join("\n"),
    html: [
      `<p>${escapeHtml(greeting)}</p>`,
      `<p>Thanks for sending us your ${escapeHtml(typeLabel)}. Our admin team reviewed it and sent the response below.</p>`,
      `<div style="padding:16px;border-radius:12px;background:#0f172a;color:#e5e7eb;border:1px solid rgba(148,163,184,0.18);white-space:pre-wrap;">${escapeHtml(responseMessage)}</div>`,
      `<p style="margin-top:20px;color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;">Original submission</p>`,
      `<p style="color:#cbd5e1;line-height:1.7;">${escapeHtml(feedbackPreview)}</p>`,
      `<p>Thanks for helping improve CodeUI.</p>`,
    ].join(""),
  })
}