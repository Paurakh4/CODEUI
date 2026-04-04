export const ASSISTANT_DUPLICATE_WINDOW_MS = 30_000

type TimestampValue = Date | string | number | null | undefined

export interface ComparableChatMessage {
  role?: string | null
  content?: string | null
  thinkingContent?: string | null
  createdAt?: TimestampValue
  timestamp?: TimestampValue
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim()
}

function toTimestamp(value: TimestampValue): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
  }

  return null
}

export function areLikelyDuplicateAssistantMessages(
  previous: ComparableChatMessage | null | undefined,
  next: ComparableChatMessage | null | undefined,
  duplicateWindowMs: number = ASSISTANT_DUPLICATE_WINDOW_MS,
): boolean {
  if (!previous || !next) {
    return false
  }

  if (previous.role !== "assistant" || next.role !== "assistant") {
    return false
  }

  if (normalizeText(previous.content) !== normalizeText(next.content)) {
    return false
  }

  if (normalizeText(previous.thinkingContent) !== normalizeText(next.thinkingContent)) {
    return false
  }

  const previousTimestamp = toTimestamp(previous.createdAt ?? previous.timestamp)
  const nextTimestamp = toTimestamp(next.createdAt ?? next.timestamp)

  if (previousTimestamp === null || nextTimestamp === null) {
    return true
  }

  return Math.abs(previousTimestamp - nextTimestamp) <= duplicateWindowMs
}

export function dedupeAdjacentAssistantMessages<T extends ComparableChatMessage>(
  messages: T[],
  duplicateWindowMs: number = ASSISTANT_DUPLICATE_WINDOW_MS,
): T[] {
  const deduped: T[] = []

  for (const message of messages) {
    const previous = deduped[deduped.length - 1]
    if (areLikelyDuplicateAssistantMessages(previous, message, duplicateWindowMs)) {
      continue
    }

    deduped.push(message)
  }

  return deduped
}