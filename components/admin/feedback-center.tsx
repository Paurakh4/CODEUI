"use client"

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react"
import {
  BellRing,
  CheckCheck,
  Clock3,
  Loader2,
  Mail,
  MessageSquare,
  RotateCcw,
  Send,
  UserRound,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  ADMIN_FEEDBACK_PAGE_SIZES,
  ADMIN_FEEDBACK_STATUS_FILTERS,
  type AdminFeedbackPageData,
  type AdminFeedbackQuery,
  type AdminFeedbackStatusFilter,
  type FeedbackEmailDeliveryStatus,
  type FeedbackStatus,
} from "@/lib/admin/feedback-types"
import { cn } from "@/lib/utils"

interface AdminFeedbackCenterProps {
  initialData: AdminFeedbackPageData
  canManageFeedback: boolean
}

const statusLabels: Record<AdminFeedbackStatusFilter | FeedbackStatus, string> = {
  all: "All",
  new: "New",
  read: "Read",
  responded: "Responded",
}

const typeLabels = {
  bug: "Bug",
  feature: "Feature",
  general: "General",
} as const

const statusBadgeClassNames: Record<FeedbackStatus, string> = {
  new: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  read: "border-sky-500/30 bg-sky-500/10 text-sky-100",
  responded: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
}

const responseEmailStatusLabels: Record<FeedbackEmailDeliveryStatus, string> = {
  "not-requested": "Not emailed",
  sent: "Email sent",
  skipped: "Delivery skipped",
  failed: "Delivery failed",
}

const responseEmailStatusClassNames: Record<FeedbackEmailDeliveryStatus, string> = {
  "not-requested": "border-white/10 bg-white/[0.05] text-[#D6D8DA]",
  sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  skipped: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  failed: "border-red-500/30 bg-red-500/10 text-red-100",
}

const typeBadgeClassNames = {
  bug: "border-red-500/30 bg-red-500/10 text-red-100",
  feature: "border-violet-500/30 bg-violet-500/10 text-violet-100",
  general: "border-white/10 bg-white/[0.05] text-[#D6D8DA]",
} as const

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function getStatusCount(data: AdminFeedbackPageData, status: AdminFeedbackStatusFilter) {
  if (status === "all") {
    return data.summary.totalFeedback
  }

  if (status === "new") {
    return data.summary.newCount
  }

  if (status === "read") {
    return data.summary.readCount
  }

  return data.summary.respondedCount
}

function buildFeedbackQuery(filters: AdminFeedbackQuery) {
  const params = new URLSearchParams()

  if (filters.status !== "all") {
    params.set("status", filters.status)
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page))
  }

  if (filters.pageSize !== 25) {
    params.set("pageSize", String(filters.pageSize))
  }

  return params.toString()
}

function pickSelectedFeedbackId(
  nextData: AdminFeedbackPageData,
  currentSelectedFeedbackId: string | null,
) {
  if (
    currentSelectedFeedbackId &&
    nextData.feedback.some((feedback) => feedback.id === currentSelectedFeedbackId)
  ) {
    return currentSelectedFeedbackId
  }

  return nextData.feedback[0]?.id ?? null
}

export function AdminFeedbackCenter({
  initialData,
  canManageFeedback,
}: AdminFeedbackCenterProps) {
  const [data, setData] = useState(initialData)
  const [filters, setFilters] = useState(initialData.filters)
  const [selectedFeedbackId, setSelectedFeedbackId] = useState(
    initialData.feedback[0]?.id ?? null,
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [statusBeingApplied, setStatusBeingApplied] = useState<FeedbackStatus | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState<string | null>(null)
  const [adminNoteDraft, setAdminNoteDraft] = useState(initialData.feedback[0]?.adminNote ?? "")
  const [responseMessageDraft, setResponseMessageDraft] = useState(
    initialData.feedback[0]?.responseMessage ?? "",
  )
  const [sendEmail, setSendEmail] = useState(false)
  const skipNextRefresh = useRef(true)

  const selectedFeedback =
    data.feedback.find((feedback) => feedback.id === selectedFeedbackId) ?? data.feedback[0] ?? null
  const hasDraftChanges = selectedFeedback
    ? adminNoteDraft.trim() !== selectedFeedback.adminNote ||
      responseMessageDraft.trim() !== selectedFeedback.responseMessage ||
      sendEmail
    : false

  useEffect(() => {
    if (!selectedFeedback) {
      setAdminNoteDraft("")
      setResponseMessageDraft("")
      setSendEmail(false)
      return
    }

    setAdminNoteDraft(selectedFeedback.adminNote)
    setResponseMessageDraft(selectedFeedback.responseMessage)
    setSendEmail(false)
  }, [selectedFeedback?.id, selectedFeedback?.updatedAt])

  const refreshSnapshot = useEffectEvent(async (nextFilters: AdminFeedbackQuery) => {
    setIsRefreshing(true)

    try {
      const query = buildFeedbackQuery(nextFilters)
      const response = await fetch(`/api/admin/feedback${query ? `?${query}` : ""}`, {
        cache: "no-store",
      })
      const payload = (await response.json().catch(() => null)) as
        | AdminFeedbackPageData
        | {
            error?: string
          }
        | null

      if (!response.ok) {
        throw new Error(
          payload && "error" in payload
            ? payload.error || "Failed to load feedback"
            : "Failed to load feedback",
        )
      }

      if (!payload || !("feedback" in payload)) {
        throw new Error("Failed to load feedback")
      }

      startTransition(() => {
        const nextData = payload as AdminFeedbackPageData
        setData(nextData)
        setSelectedFeedbackId((currentSelectedId) =>
          pickSelectedFeedbackId(nextData, currentSelectedId),
        )
        setErrorMessage(null)
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load feedback")
    } finally {
      setIsRefreshing(false)
    }
  })

  const updateFeedbackStatus = useEffectEvent(async (status: FeedbackStatus) => {
    if (!selectedFeedback || !canManageFeedback) {
      return
    }

    setStatusBeingApplied(status)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/feedback/${selectedFeedback.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          adminNote: adminNoteDraft,
          responseMessage: responseMessageDraft,
          sendEmail: status === "responded" ? sendEmail : false,
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update feedback")
      }

      const emailDeliveryStatus = payload?.emailDelivery?.status as
        | FeedbackEmailDeliveryStatus
        | undefined

      if (status === "responded") {
        if (emailDeliveryStatus === "sent") {
          setLiveMessage("Response saved and emailed to the user.")
        } else if (emailDeliveryStatus === "skipped") {
          setLiveMessage(
            "Response saved. Email delivery was skipped because SMTP is not configured.",
          )
        } else if (emailDeliveryStatus === "failed") {
          setLiveMessage(
            payload?.emailDelivery?.errorMessage
              ? `Response saved, but email delivery failed: ${payload.emailDelivery.errorMessage}`
              : "Response saved, but email delivery failed.",
          )
        } else {
          setLiveMessage("Response saved without sending an email.")
        }
      } else {
        setLiveMessage(`Feedback marked as ${statusLabels[status].toLowerCase()}.`)
      }

      await refreshSnapshot(filters)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update feedback")
    } finally {
      setStatusBeingApplied(null)
    }
  })

  const handleRealtimeEvent = useEffectEvent(
    async (eventType: "feedback.created" | "feedback.updated") => {
      setLiveMessage(
        eventType === "feedback.created"
          ? "New feedback received live."
          : "Feedback status changed live.",
      )

      await refreshSnapshot(filters)
    },
  )

  useEffect(() => {
    if (skipNextRefresh.current) {
      skipNextRefresh.current = false
      return
    }

    void refreshSnapshot(filters)
  }, [filters.page, filters.pageSize, filters.status])

  useEffect(() => {
    const eventSource = new EventSource("/api/admin/feedback/stream")

    const handleCreated = () => {
      void handleRealtimeEvent("feedback.created")
    }

    const handleUpdated = () => {
      void handleRealtimeEvent("feedback.updated")
    }

    const handleError = () => {
      setLiveMessage("Live feedback stream is reconnecting.")
    }

    eventSource.addEventListener("feedback.created", handleCreated as EventListener)
    eventSource.addEventListener("feedback.updated", handleUpdated as EventListener)
    eventSource.addEventListener("error", handleError as EventListener)

    return () => {
      eventSource.removeEventListener("feedback.created", handleCreated as EventListener)
      eventSource.removeEventListener("feedback.updated", handleUpdated as EventListener)
      eventSource.removeEventListener("error", handleError as EventListener)
      eventSource.close()
    }
  }, [])

  function handleRespondAction() {
    if (!selectedFeedback) {
      return
    }

    if (sendEmail && responseMessageDraft.trim().length === 0) {
      setErrorMessage("Write a response message before emailing the user.")
      return
    }

    void updateFeedbackStatus("responded")
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Unread</p>
          <p className="mt-3 text-3xl font-semibold text-white">{data.summary.unreadCount}</p>
          <p className="mt-2 text-sm text-[#A6A6A6]">New feedback waiting for review</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Read</p>
          <p className="mt-3 text-3xl font-semibold text-white">{data.summary.readCount}</p>
          <p className="mt-2 text-sm text-[#A6A6A6]">Opened but not yet closed out</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Responded</p>
          <p className="mt-3 text-3xl font-semibold text-white">{data.summary.respondedCount}</p>
          <p className="mt-2 text-sm text-[#A6A6A6]">Handled items kept for reference</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <div className="flex items-center gap-2 text-[#7FD0FF]">
            <BellRing className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Live Feed</p>
          </div>
          <p className="mt-3 text-lg font-semibold text-white">
            {liveMessage || "Waiting for the next submission"}
          </p>
          <p className="mt-2 text-sm text-[#A6A6A6]">
            {isRefreshing
              ? "Refreshing the admin queue..."
              : "Stream stays connected while this page is open."}
          </p>
        </article>
      </section>

      <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {ADMIN_FEEDBACK_STATUS_FILTERS.map((status) => {
              const isActive = filters.status === status

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      status,
                      page: 1,
                    }))
                  }
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                    isActive
                      ? "border-[#0AA6FF]/40 bg-[#0AA6FF]/12 text-white"
                      : "border-white/10 bg-white/[0.02] text-[#C3C7CB] hover:border-white/20 hover:bg-white/[0.04]",
                  )}
                >
                  <span>{statusLabels[status]}</span>
                  <Badge className="border-transparent bg-black/30 text-white hover:bg-black/30">
                    {getStatusCount(data, status)}
                  </Badge>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[#C3C7CB]">
              <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Page Size</span>
              <select
                value={String(filters.pageSize)}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    page: 1,
                    pageSize: Number(event.target.value) as AdminFeedbackQuery["pageSize"],
                  }))
                }
                className="h-10 rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]"
              >
                {ADMIN_FEEDBACK_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <Button
              type="button"
              variant="outline"
              onClick={() => void refreshSnapshot(filters)}
              disabled={isRefreshing}
              className="border-white/10 bg-white/[0.02] text-white hover:bg-white/[0.04]"
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-white/8 bg-[#0F1113] p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4 border-b border-white/8 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Queue</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Recent feedback submissions</h2>
            </div>
            <Badge className="border-[#0AA6FF]/30 bg-[#0AA6FF]/10 text-[#7FD0FF] hover:bg-[#0AA6FF]/10">
              {data.pagination.totalFeedback} visible
            </Badge>
          </div>

          <div className="space-y-3">
            {data.feedback.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-10 text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-[#71717A]" />
                <p className="mt-4 text-lg font-medium text-white">No feedback in this status yet.</p>
                <p className="mt-2 text-sm text-[#A6A6A6]">
                  Switch filters or wait for the next live submission.
                </p>
              </div>
            ) : (
              data.feedback.map((feedback) => {
                const isSelected = feedback.id === selectedFeedback?.id

                return (
                  <button
                    key={feedback.id}
                    type="button"
                    onClick={() => setSelectedFeedbackId(feedback.id)}
                    className={cn(
                      "w-full rounded-[24px] border px-5 py-4 text-left transition-all",
                      isSelected
                        ? "border-[#0AA6FF]/40 bg-[#0AA6FF]/10 shadow-[0_0_0_1px_rgba(10,166,255,0.12)]"
                        : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-white">{feedback.user.name}</p>
                          <Badge className={cn("hover:bg-inherit", typeBadgeClassNames[feedback.type])}>
                            {typeLabels[feedback.type]}
                          </Badge>
                          <Badge className={cn("hover:bg-inherit", statusBadgeClassNames[feedback.status])}>
                            {statusLabels[feedback.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-[#A6A6A6]">{feedback.user.email}</p>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#D6D8DA]">{feedback.preview}</p>
                        {feedback.pathname ? (
                          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#71717A]">
                            {feedback.pathname}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2 text-xs text-[#A6A6A6]">
                        {feedback.status === "new" ? (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-80" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                          </span>
                        ) : null}
                        <time dateTime={feedback.createdAt}>{formatTimestamp(feedback.createdAt)}</time>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/8 pt-4">
            <p className="text-sm text-[#A6A6A6]">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: Math.max(1, current.page - 1),
                  }))
                }
                disabled={!data.pagination.hasPreviousPage}
                className="border-white/10 bg-white/[0.02] text-white hover:bg-white/[0.04]"
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
                disabled={!data.pagination.hasNextPage}
                className="border-white/10 bg-white/[0.02] text-white hover:bg-white/[0.04]"
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          {selectedFeedback ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Details</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{selectedFeedback.user.name}</h2>
                  <p className="mt-2 text-sm text-[#A6A6A6]">{selectedFeedback.user.email}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("hover:bg-inherit", typeBadgeClassNames[selectedFeedback.type])}>
                    {typeLabels[selectedFeedback.type]}
                  </Badge>
                  <Badge className={cn("hover:bg-inherit", statusBadgeClassNames[selectedFeedback.status])}>
                    {statusLabels[selectedFeedback.status]}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-[#7FD0FF]">
                    <Clock3 className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Submitted</p>
                  </div>
                  <time dateTime={selectedFeedback.createdAt} className="mt-3 block text-sm font-medium text-white">
                    {formatTimestamp(selectedFeedback.createdAt)}
                  </time>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-[#7FD0FF]">
                    <UserRound className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Context</p>
                  </div>
                  <p className="mt-3 text-sm font-medium text-white">
                    {selectedFeedback.pathname || "No page context was attached."}
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Full Message</p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#E5E7EB]">
                  {selectedFeedback.message}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Read Timestamp</p>
                  <p className="mt-3 text-sm font-medium text-white">
                    {selectedFeedback.readAt ? formatTimestamp(selectedFeedback.readAt) : "Unread"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Responded Timestamp</p>
                  <p className="mt-3 text-sm font-medium text-white">
                    {selectedFeedback.respondedAt
                      ? formatTimestamp(selectedFeedback.respondedAt)
                      : "Not marked responded"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-[#7FD0FF]">
                    <Mail className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Reply Delivery</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge
                      className={cn(
                        "hover:bg-inherit",
                        responseEmailStatusClassNames[selectedFeedback.responseEmail.status],
                      )}
                    >
                      {responseEmailStatusLabels[selectedFeedback.responseEmail.status]}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-medium text-white">
                    {selectedFeedback.responseEmail.sentAt
                      ? formatTimestamp(selectedFeedback.responseEmail.sentAt)
                      : selectedFeedback.responseEmail.recipient || "No reply email has been attempted yet."}
                  </p>
                  {selectedFeedback.responseEmail.errorMessage ? (
                    <p className="mt-2 text-xs leading-5 text-[#FCA5A5]">
                      {selectedFeedback.responseEmail.errorMessage}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.02] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Internal Note</p>
                <p className="mt-2 text-sm text-[#A6A6A6]">
                  Private context for the admin team. This is never sent to the user.
                </p>
                <Textarea
                  value={adminNoteDraft}
                  onChange={(event) => setAdminNoteDraft(event.target.value)}
                  disabled={!canManageFeedback || statusBeingApplied !== null}
                  placeholder="Capture follow-up context, triage notes, or the next action for the team..."
                  className="mt-4 min-h-[120px] border-white/10 bg-[#0B0C0D] text-white placeholder:text-[#6B7280]"
                />
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.02] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Response Draft</p>
                <p className="mt-2 text-sm text-[#A6A6A6]">
                  Save a reply with the feedback item, and optionally send it as an email when you mark the item responded.
                </p>
                <Textarea
                  value={responseMessageDraft}
                  onChange={(event) => setResponseMessageDraft(event.target.value)}
                  disabled={!canManageFeedback || statusBeingApplied !== null}
                  placeholder="Write the response you want associated with this feedback..."
                  className="mt-4 min-h-[160px] border-white/10 bg-[#0B0C0D] text-white placeholder:text-[#6B7280]"
                />

                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-[#D6D8DA]">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(event) => setSendEmail(event.target.checked)}
                    disabled={!canManageFeedback || statusBeingApplied !== null}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-[#0B0C0D] text-[#0AA6FF]"
                  />
                  <span>
                    Email this response to {selectedFeedback.user.email} when saving it as responded.
                  </span>
                </label>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Actions</p>
                    <p className="mt-2 text-sm text-[#A6A6A6]">
                      Update the review state, keep internal notes, and optionally send a reply without leaving the live queue.
                    </p>
                  </div>
                  {!canManageFeedback ? (
                    <Badge variant="outline" className="border-white/10 text-[#A6A6A6]">
                      Read only
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void updateFeedbackStatus("new")}
                    disabled={
                      !canManageFeedback ||
                      statusBeingApplied !== null ||
                      selectedFeedback.status === "new"
                    }
                    className="border-white/10 bg-white/[0.02] text-white hover:bg-white/[0.04]"
                  >
                    {statusBeingApplied === "new" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Mark New
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void updateFeedbackStatus("read")}
                    disabled={
                      !canManageFeedback ||
                      statusBeingApplied !== null ||
                      selectedFeedback.status === "read"
                    }
                    className="border-white/10 bg-white/[0.02] text-white hover:bg-white/[0.04]"
                  >
                    {statusBeingApplied === "read" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCheck className="h-4 w-4" />
                    )}
                    Mark Read
                  </Button>
                  <Button
                    type="button"
                    onClick={handleRespondAction}
                    disabled={
                      !canManageFeedback ||
                      statusBeingApplied !== null ||
                      (selectedFeedback.status === "responded" && !hasDraftChanges)
                    }
                    className="bg-[#0AA6FF] text-white hover:bg-[#0AA6FF]/90"
                  >
                    {statusBeingApplied === "responded" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {selectedFeedback.status === "responded" ? "Save Response" : "Mark Responded"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-black/20 px-8 text-center">
              <MessageSquare className="h-10 w-10 text-[#71717A]" />
              <p className="mt-4 text-xl font-semibold text-white">Select feedback to inspect it.</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#A6A6A6]">
                New submissions will stream in here automatically while the admin dashboard stays open.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}