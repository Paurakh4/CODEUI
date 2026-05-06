import "server-only"

import connectDB from "@/lib/db"
import type { AdminFeedbackStreamEvent } from "@/lib/admin/feedback-types"
import { Feedback } from "@/lib/models"

type FeedbackListener = (event: AdminFeedbackStreamEvent) => void

declare global {
  var __codeuiAdminFeedbackState:
    | {
        listeners: Set<FeedbackListener>
        changeStream: ReturnType<typeof Feedback.watch> | null
        isStarting: boolean
        restartTimer: NodeJS.Timeout | null
        unsupportedUntil: number
        recentEventKeys: Map<string, number>
      }
    | undefined
}

function getFeedbackState() {
  if (!global.__codeuiAdminFeedbackState) {
    global.__codeuiAdminFeedbackState = {
      listeners: new Set<FeedbackListener>(),
      changeStream: null,
      isStarting: false,
      restartTimer: null,
      unsupportedUntil: 0,
      recentEventKeys: new Map<string, number>(),
    }
  }

  return global.__codeuiAdminFeedbackState
}

function getEventKey(event: AdminFeedbackStreamEvent) {
  if (event.type === "feedback.created") {
    return `${event.type}:${event.data.feedbackId}:${event.data.createdAt}`
  }

  return `${event.type}:${event.data.feedbackId}:${event.data.updatedAt}`
}

function pruneRecentEventKeys(state: ReturnType<typeof getFeedbackState>) {
  const cutoff = Date.now() - 10_000

  for (const [key, timestamp] of state.recentEventKeys.entries()) {
    if (timestamp < cutoff) {
      state.recentEventKeys.delete(key)
    }
  }
}

function emitAdminFeedbackEvent(
  event: AdminFeedbackStreamEvent,
  source: "local" | "database",
) {
  const state = getFeedbackState()
  pruneRecentEventKeys(state)

  const eventKey = getEventKey(event)

  if (source === "database" && state.recentEventKeys.has(eventKey)) {
    state.recentEventKeys.delete(eventKey)
    return
  }

  if (source === "local") {
    state.recentEventKeys.set(eventKey, Date.now())
  }

  for (const listener of state.listeners) {
    try {
      listener(event)
    } catch (error) {
      console.error("ADMIN_FEEDBACK_EVENT_LISTENER_ERROR", error)
    }
  }
}

function isChangeStreamUnsupported(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  return (
    normalized.includes("changestream") && normalized.includes("replica")
  ) || normalized.includes("only supported on replica sets")
}

function stopAdminFeedbackChangeStream() {
  const state = getFeedbackState()

  if (state.changeStream) {
    state.changeStream.removeAllListeners()
    void state.changeStream.close().catch(() => undefined)
    state.changeStream = null
  }
}

function scheduleAdminFeedbackChangeStreamRestart(error?: unknown) {
  const state = getFeedbackState()

  if (state.listeners.size === 0 || state.restartTimer) {
    return
  }

  if (error && isChangeStreamUnsupported(error)) {
    state.unsupportedUntil = Date.now() + 60_000
    console.warn(
      "ADMIN_FEEDBACK_CHANGE_STREAM_UNAVAILABLE",
      error instanceof Error ? error.message : error,
    )
    return
  }

  state.restartTimer = setTimeout(() => {
    state.restartTimer = null
    void ensureAdminFeedbackChangeStream()
  }, 1_000)
}

function handleAdminFeedbackChange(change: {
  operationType: string
  fullDocument?: {
    _id: { toString(): string }
    type?: AdminFeedbackStreamEvent extends { type: "feedback.created"; data: infer Data }
      ? Data extends { feedbackType: infer FeedbackTypeValue }
        ? FeedbackTypeValue
        : never
      : never
    status?: AdminFeedbackStreamEvent extends { type: "feedback.updated"; data: infer Data }
      ? Data extends { status: infer FeedbackStatusValue }
        ? FeedbackStatusValue
        : never
      : never
    createdAt?: Date
    updatedAt?: Date
  }
}) {
  const fullDocument = change.fullDocument

  if (!fullDocument) {
    return
  }

  if (
    change.operationType === "insert" &&
    fullDocument.type &&
    fullDocument.status &&
    fullDocument.createdAt
  ) {
    emitAdminFeedbackEvent(
      {
        type: "feedback.created",
        data: {
          feedbackId: fullDocument._id.toString(),
          status: fullDocument.status,
          feedbackType: fullDocument.type,
          createdAt: fullDocument.createdAt.toISOString(),
        },
      },
      "database",
    )
    return
  }

  if (
    (change.operationType === "update" || change.operationType === "replace") &&
    fullDocument.status &&
    fullDocument.updatedAt
  ) {
    emitAdminFeedbackEvent(
      {
        type: "feedback.updated",
        data: {
          feedbackId: fullDocument._id.toString(),
          status: fullDocument.status,
          updatedAt: fullDocument.updatedAt.toISOString(),
        },
      },
      "database",
    )
  }
}

async function ensureAdminFeedbackChangeStream() {
  const state = getFeedbackState()

  if (
    state.listeners.size === 0 ||
    state.changeStream ||
    state.isStarting ||
    Date.now() < state.unsupportedUntil
  ) {
    return
  }

  state.isStarting = true

  try {
    await connectDB()
    const changeStream = Feedback.watch([], {
      fullDocument: "updateLookup",
    })

    state.changeStream = changeStream
    changeStream.on("change", handleAdminFeedbackChange)
    changeStream.on("error", (error) => {
      console.error("ADMIN_FEEDBACK_CHANGE_STREAM_ERROR", error)
      stopAdminFeedbackChangeStream()
      scheduleAdminFeedbackChangeStreamRestart(error)
    })
    changeStream.on("close", () => {
      stopAdminFeedbackChangeStream()
      scheduleAdminFeedbackChangeStreamRestart()
    })
    changeStream.on("end", () => {
      stopAdminFeedbackChangeStream()
      scheduleAdminFeedbackChangeStreamRestart()
    })
  } catch (error) {
    scheduleAdminFeedbackChangeStreamRestart(error)
  } finally {
    state.isStarting = false
  }
}

export function subscribeToAdminFeedback(listener: FeedbackListener) {
  const state = getFeedbackState()
  state.listeners.add(listener)
  void ensureAdminFeedbackChangeStream()

  return () => {
    const currentState = getFeedbackState()
    currentState.listeners.delete(listener)

    if (currentState.listeners.size === 0) {
      if (currentState.restartTimer) {
        clearTimeout(currentState.restartTimer)
        currentState.restartTimer = null
      }

      stopAdminFeedbackChangeStream()
    }
  }
}

export function publishAdminFeedbackEvent(event: AdminFeedbackStreamEvent) {
  emitAdminFeedbackEvent(event, "local")
}

export function resetAdminFeedbackEventStateForTests() {
  const state = getFeedbackState()
  state.listeners.clear()
  state.recentEventKeys.clear()
  state.unsupportedUntil = 0
  state.isStarting = false

  if (state.restartTimer) {
    clearTimeout(state.restartTimer)
    state.restartTimer = null
  }

  stopAdminFeedbackChangeStream()
}