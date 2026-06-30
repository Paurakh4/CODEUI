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
  new: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  read: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  responded: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
}

const responseEmailStatusLabels: Record<FeedbackEmailDeliveryStatus, string> = {
  "not-requested": "Not emailed",
  sent: "Email sent",
  skipped: "Delivery skipped",
  failed: "Delivery failed",
}

const responseEmailStatusClassNames: Record<FeedbackEmailDeliveryStatus, string> = {
  "not-requested": "border-white/[0.04] bg-[#1B1B1F]/50 text-[#9B9B9F]",
  sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  skipped: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  failed: "border-red-500/30 bg-red-500/10 text-red-100",
}

const typeBadgeClassNames = {
  bug: "border-red-500/30 bg-red-500/10 text-red-100",
  feature: "border-violet-500/30 bg-violet-500/10 text-violet-100",
  general: "border-white/[0.04] bg-[#1B1B1F]/50 text-[#9B9B9F]",
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
        <article className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-5">
          <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Unread</p>
          <p className="mt-3 text-3xl font-semibold text-[#E7E7E9]">{data.summary.unreadCount}</p>
          <p className="mt-2 text-sm text-[#9B9B9F]">New feedback waiting for review</p>
        </article>
        <article className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-5">
          <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Read</p>
          <p className="mt-3 text-3xl font-semibold text-[#E7E7E9]">{data.summary.readCount}</p>
          <p className="mt-2 text-sm text-[#9B9B9F]">Opened but not yet closed out</p>
        </article>
        <article className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-5">
          <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Responded</p>
          <p className="mt-3 text-3xl font-semibold text-[#E7E7E9]">{data.summary.respondedCount}</p>
          <p className="mt-2 text-sm text-[#9B9B9F]">Handled items kept for reference</p>
        </article>
        <article className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-5">
          <div className="flex items-center gap-2 text-[#E7E7E9]">
            <BellRing className="h-4 w-4" />
            <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Live Feed</p>
          </div>
          <p className="mt-3 text-lg font-semibold text-[#E7E7E9]">
            {liveMessage || "Waiting for the next submission"}
          </p>
          <p className="mt-2 text-sm text-[#9B9B9F]">
            {isRefreshing
              ? "Refreshing the admin queue..."
              : "Stream stays connected while this page is open."}
          </p>
        </article>
      </section>

      <section className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-6">
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
                      ? "border-white/10 bg-[#1B1B1F] text-[#E7E7E9]"
                      : "border-white/[0.04] bg-transparent text-[#9B9B9F] hover:border-white/10 hover:bg-[#1B1B1F]",
                  )}
                >
                  <span>{statusLabels[status]}</span>
                  <Badge className="border-transparent bg-[#1B1B1F] text-[#E7E7E9] hover:bg-[#1B1B1F]">
                    {getStatusCount(data, status)}
                  </Badge>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[#9B9B9F]">
              <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Page Size</span>
              <select
                value={String(filters.pageSize)}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    page: 1,
                    pageSize: Number(event.target.value) as AdminFeedbackQuery["pageSize"],
                  }))
                }
                className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] outline-none transition-colors focus-visible:border-white/[0.10]"
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
              variant="ghost"
              onClick={() => void refreshSnapshot(filters)}
              disabled={isRefreshing}
              className="text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F]"
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-lg border border-white/[0.04] bg-[#1B1B1F] px-4 py-3 text-sm text-[#9B9B9F]">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4 border-b border-white/[0.04] pb-4">
            <div>
              <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Queue</p>
              <h2 className="mt-1 text-xl font-semibold text-[#E7E7E9]">Recent feedback submissions</h2>
            </div>
            <Badge className="border border-white/[0.04] bg-[#1B1B1F] text-[#E7E7E9]">
              {data.pagination.totalFeedback} visible
            </Badge>
          </div>

          <div className="space-y-3">
            {data.feedback.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.04] bg-[#0E0E10] px-6 py-10 text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-[#9B9B9F]" />
                <p className="mt-4 text-lg font-medium text-[#E7E7E9]">No feedback in this status yet.</p>
                <p className="mt-2 text-sm text-[#9B9B9F]">
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
                      "w-full rounded-lg border px-5 py-4 text-left transition-all",
                      isSelected
                        ? "border-white/20 bg-[#242428] ring-1 ring-white/15"
                        : "border-white/[0.04] bg-[#0E0E10] hover:border-white/10 hover:bg-[#1B1B1F]",
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-[#E7E7E9]">{feedback.user.name}</p>
                          <Badge className={cn("hover:bg-inherit", typeBadgeClassNames[feedback.type])}>
                            {typeLabels[feedback.type]}
                          </Badge>
                          <Badge className={cn("hover:bg-inherit", statusBadgeClassNames[feedback.status])}>
                            {statusLabels[feedback.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-[#9B9B9F]">{feedback.user.email}</p>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#9B9B9F]">{feedback.preview}</p>
                        {feedback.pathname ? (
                          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#9B9B9F]">
                            {feedback.pathname}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2 text-xs text-[#9B9B9F]">
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

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.04] pt-4">
            <p className="text-sm text-[#9B9B9F]">
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
                className="border border-white/[0.04] bg-transparent text-[#9B9B9F] hover:bg-[#1B1B1F] hover:text-[#E7E7E9]"
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
                className="border border-white/[0.04] bg-transparent text-[#9B9B9F] hover:bg-[#1B1B1F] hover:text-[#E7E7E9]"
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-6">
          {selectedFeedback ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-white/[0.04] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Details</p>
                  <h2 className="mt-1 text-2xl font-semibold text-[#E7E7E9]">{selectedFeedback.user.name}</h2>
                  <p className="mt-2 text-sm text-[#9B9B9F]">{selectedFeedback.user.email}</p>
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
                <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-4">
                  <div className="flex items-center gap-2 text-[#E7E7E9]">
                    <Clock3 className="h-4 w-4" />
                    <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Submitted</p>
                  </div>
                  <time dateTime={selectedFeedback.createdAt} className="mt-3 block text-sm font-medium text-[#E7E7E9]">
                    {formatTimestamp(selectedFeedback.createdAt)}
                  </time>
                </div>

                <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-4">
                  <div className="flex items-center gap-2 text-[#E7E7E9]">
                    <UserRound className="h-4 w-4" />
                    <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Context</p>
                  </div>
                  <p className="mt-3 text-sm font-medium text-[#E7E7E9]">
                    {selectedFeedback.pathname || "No page context was attached."}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-5">
                <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Full Message</p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#E5E7EB]">
                  {selectedFeedback.message}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-4">
                  <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Read Timestamp</p>
                  <p className="mt-3 text-sm font-medium text-[#E7E7E9]">
                    {selectedFeedback.readAt ? formatTimestamp(selectedFeedback.readAt) : "Unread"}
                  </p>
                </div>

                <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-4">
                  <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Responded Timestamp</p>
                  <p className="mt-3 text-sm font-medium text-[#E7E7E9]">
                    {selectedFeedback.respondedAt
                      ? formatTimestamp(selectedFeedback.respondedAt)
                      : "Not marked responded"}
                  </p>
                </div>

                <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-[#E7E7E9]">
                    <Mail className="h-4 w-4" />
                    <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Reply Delivery</p>
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
                  <p className="mt-3 text-sm font-medium text-[#E7E7E9]">
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

              <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-5">
                <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Internal Note</p>
                <p className="mt-2 text-sm text-[#9B9B9F]">
                  Private context for the admin team. This is never sent to the user.
                </p>
                <Textarea
                  value={adminNoteDraft}
                  onChange={(event) => setAdminNoteDraft(event.target.value)}
                  disabled={!canManageFeedback || statusBeingApplied !== null}
                  placeholder="Capture follow-up context, triage notes, or the next action for the team..."
                  className="mt-4 min-h-[120px] border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9] placeholder:text-[#9B9B9F]/50"
                />
              </div>

              <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-5">
                <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Response Draft</p>
                <p className="mt-2 text-sm text-[#9B9B9F]">
                  Save a reply with the feedback item, and optionally send it as an email when you mark the item responded.
                </p>
                <Textarea
                  value={responseMessageDraft}
                  onChange={(event) => setResponseMessageDraft(event.target.value)}
                  disabled={!canManageFeedback || statusBeingApplied !== null}
                  placeholder="Write the response you want associated with this feedback..."
                  className="mt-4 min-h-[160px] border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9] placeholder:text-[#9B9B9F]/50"
                />

                <label className="mt-4 flex items-start gap-3 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-4 py-3 text-sm text-[#9B9B9F]">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(event) => setSendEmail(event.target.checked)}
                    disabled={!canManageFeedback || statusBeingApplied !== null}
                    className="mt-1 h-4 w-4 rounded border-border bg-background text-primary"
                  />
                  <span>
                    Email this response to {selectedFeedback.user.email} when saving it as responded.
                  </span>
                </label>
              </div>

              <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Actions</p>
                    <p className="mt-2 text-sm text-[#9B9B9F]">
                      Update the review state, keep internal notes, and optionally send a reply without leaving the live queue.
                    </p>
                  </div>
                  {!canManageFeedback ? (
                    <Badge variant="outline" className="border-white/[0.04] text-[#9B9B9F]">
                      Read only
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void updateFeedbackStatus("new")}
                    disabled={
                      !canManageFeedback ||
                      statusBeingApplied !== null ||
                      selectedFeedback.status === "new"
                    }
                    className="text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F]"
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
                    variant="ghost"
                    onClick={() => void updateFeedbackStatus("read")}
                    disabled={
                      !canManageFeedback ||
                      statusBeingApplied !== null ||
                      selectedFeedback.status === "read"
                    }
                    className="text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F]"
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
                    className="bg-[#E7E7E9] text-[#0E0E10] hover:bg-white"
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
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.04] bg-[#0E0E10] px-8 text-center">
              <MessageSquare className="h-10 w-10 text-[#9B9B9F]" />
              <p className="mt-4 text-xl font-semibold text-[#E7E7E9]">Select feedback to inspect it.</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#9B9B9F]">
                New submissions will stream in here automatically while the admin dashboard stays open.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}