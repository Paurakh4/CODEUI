import { describe, expect, it } from "vitest"

import {
  areLikelyDuplicateAssistantMessages,
  dedupeAdjacentAssistantMessages,
} from "@/lib/utils/chat-message-dedupe"

describe("chat message dedupe", () => {
  it("detects duplicate adjacent assistant messages with matching content and nearby timestamps", () => {
    const previous = {
      role: "assistant",
      content: "Generated: pricing card.",
      thinkingContent: "thinking",
      createdAt: new Date("2026-04-05T00:00:00.000Z"),
    }

    const next = {
      role: "assistant",
      content: "Generated: pricing card.",
      thinkingContent: "thinking",
      createdAt: new Date("2026-04-05T00:00:05.000Z"),
    }

    expect(areLikelyDuplicateAssistantMessages(previous, next)).toBe(true)
  })

  it("does not treat user messages or distant assistant messages as duplicates", () => {
    const previous = {
      role: "assistant",
      content: "Generated: pricing card.",
      createdAt: new Date("2026-04-05T00:00:00.000Z"),
    }

    const distantAssistant = {
      role: "assistant",
      content: "Generated: pricing card.",
      createdAt: new Date("2026-04-05T00:05:00.000Z"),
    }

    const userMessage = {
      role: "user",
      content: "Generated: pricing card.",
      createdAt: new Date("2026-04-05T00:00:05.000Z"),
    }

    expect(areLikelyDuplicateAssistantMessages(previous, distantAssistant)).toBe(false)
    expect(areLikelyDuplicateAssistantMessages(previous, userMessage)).toBe(false)
  })

  it("removes only accidental adjacent assistant duplicates when restoring messages", () => {
    const messages = [
      {
        role: "user",
        content: "Create pricing card",
        timestamp: new Date("2026-04-05T00:00:00.000Z"),
      },
      {
        role: "assistant",
        content: "Generated: pricing card.",
        thinkingContent: "thinking",
        timestamp: new Date("2026-04-05T00:00:10.000Z"),
      },
      {
        role: "assistant",
        content: "Generated: pricing card.",
        thinkingContent: "thinking",
        timestamp: new Date("2026-04-05T00:00:12.000Z"),
      },
      {
        role: "assistant",
        content: "Generated: pricing card.",
        thinkingContent: "thinking",
        timestamp: new Date("2026-04-05T00:02:30.000Z"),
      },
    ]

    const deduped = dedupeAdjacentAssistantMessages(messages)

    expect(deduped).toHaveLength(3)
    expect(deduped[1].timestamp).toEqual(new Date("2026-04-05T00:00:10.000Z"))
    expect(deduped[2].timestamp).toEqual(new Date("2026-04-05T00:02:30.000Z"))
  })
})