/** @vitest-environment happy-dom */

import React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdminFeedbackCenter } from "@/components/admin/feedback-center"
import type { AdminFeedbackPageData } from "@/lib/admin/feedback-types"

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "dark",
    resolvedTheme: "dark",
  }),
}))

class EventSourceMock {
  static instances: EventSourceMock[] = []

  url: string
  listeners = new Map<string, Set<(event: { data?: string }) => void>>()

  constructor(url: string) {
    this.url = url
    EventSourceMock.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener) {
    const registeredListeners = this.listeners.get(type) ?? new Set()
    registeredListeners.add(listener as unknown as (event: { data?: string }) => void)
    this.listeners.set(type, registeredListeners)
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener as unknown as (event: { data?: string }) => void)
  }

  close() {
    return undefined
  }

  emit(type: string, data?: unknown) {
    const event = { data: data ? JSON.stringify(data) : undefined }
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

const initialData: AdminFeedbackPageData = {
  feedback: [
    {
      id: "feedback-1",
      type: "general",
      status: "new",
      message: "Initial feedback from Ada.",
      preview: "Initial feedback from Ada.",
      pathname: "/dashboard",
      createdAt: "2026-05-01T08:00:00.000Z",
      updatedAt: "2026-05-01T08:00:00.000Z",
      adminNote: "",
      responseMessage: "",
      responseEmail: {
        status: "not-requested",
      },
      user: {
        id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
      },
    },
  ],
  pagination: {
    page: 1,
    pageSize: 25,
    totalFeedback: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  summary: {
    totalFeedback: 1,
    unreadCount: 1,
    newCount: 1,
    readCount: 0,
    respondedCount: 0,
  },
  filters: {
    status: "all",
    page: 1,
    pageSize: 25,
  },
}

const updatedData: AdminFeedbackPageData = {
  feedback: [
    {
      id: "feedback-2",
      type: "bug",
      status: "new",
      message: "Second feedback just landed with more detail.",
      preview: "Second feedback just landed with more detail.",
      pathname: "/project/alpha",
      createdAt: "2026-05-01T09:30:00.000Z",
      updatedAt: "2026-05-01T09:30:00.000Z",
      adminNote: "",
      responseMessage: "",
      responseEmail: {
        status: "not-requested",
      },
      user: {
        id: "user-2",
        name: "Grace Hopper",
        email: "grace@example.com",
      },
    },
    ...initialData.feedback,
  ],
  pagination: {
    page: 1,
    pageSize: 25,
    totalFeedback: 2,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  summary: {
    totalFeedback: 2,
    unreadCount: 2,
    newCount: 2,
    readCount: 0,
    respondedCount: 0,
  },
  filters: {
    status: "all",
    page: 1,
    pageSize: 25,
  },
}

describe("UT-24 AdminFeedbackCenter live updates", () => {
  const originalEventSource = global.EventSource
  const originalFetch = global.fetch
  const originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    EventSourceMock.instances = []
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    global.EventSource = EventSourceMock as unknown as typeof EventSource
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    global.fetch = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify(updatedData), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    ) as typeof fetch
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    global.EventSource = originalEventSource
    global.fetch = originalFetch
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
  })

  it("refreshes the feedback queue immediately after a realtime creation event", async () => {
    await act(async () => {
      root.render(
        React.createElement(AdminFeedbackCenter, {
          initialData,
          canManageFeedback: true,
        }),
      )
    })

    expect(container.textContent).toContain("Ada Lovelace")
    expect(container.textContent).toContain("Initial feedback from Ada.")
    expect(EventSourceMock.instances).toHaveLength(1)

    await act(async () => {
      EventSourceMock.instances[0].emit("feedback.created", {
        feedbackId: "feedback-2",
        status: "new",
        feedbackType: "bug",
        createdAt: "2026-05-01T09:30:00.000Z",
      })
      await Promise.resolve()
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain("Grace Hopper")
    expect(container.textContent).toContain("grace@example.com")
    expect(container.textContent).toContain("Second feedback just landed with more detail.")
    expect(container.textContent).toContain("2")
    expect(container.textContent).toContain("Not emailed")
    expect(
      container.querySelector('time[datetime="2026-05-01T09:30:00.000Z"]'),
    ).not.toBeNull()
  })
})