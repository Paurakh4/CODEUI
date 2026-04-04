import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { consumePendingProjectStart, storePendingProjectStart } from "@/lib/utils/project-bootstrap"

class SessionStorageMock {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  clear() {
    this.values.clear()
  }
}

describe("project bootstrap", () => {
  const originalWindow = globalThis.window
  const sessionStorage = new SessionStorageMock()

  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        sessionStorage,
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis),
      },
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: originalWindow,
    })
  })

  it("replays a pending project start once for an immediate remount", () => {
    storePendingProjectStart("project-1", {
      prompt: "Build a modern dashboard",
      model: "openai/gpt-5.4",
    })

    expect(consumePendingProjectStart("project-1")).toEqual({
      prompt: "Build a modern dashboard",
      model: "openai/gpt-5.4",
    })

    expect(consumePendingProjectStart("project-1")).toEqual({
      prompt: "Build a modern dashboard",
      model: "openai/gpt-5.4",
    })

    vi.runAllTimers()

    expect(consumePendingProjectStart("project-1")).toBeNull()
  })
})