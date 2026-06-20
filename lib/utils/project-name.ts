export const DEFAULT_PROJECT_NAME = "Untitled Project"

const MAX_PROJECT_NAME_LENGTH = 60

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function normalizeProjectName(name?: string | null, fallback = DEFAULT_PROJECT_NAME): string {
  if (!name) return fallback

  const normalized = collapseWhitespace(name)
    .replace(/^[-_.\s]+|[-_.\s]+$/g, "")
    .slice(0, MAX_PROJECT_NAME_LENGTH)

  return normalized || fallback
}

export function isDefaultProjectName(name?: string | null): boolean {
  if (!name) return true

  const normalized = collapseWhitespace(name)
    .toLowerCase()
    .replace(/[-_]/g, " ")

  return normalized === "untitled project" || normalized === "new project" || normalized === "project"
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => {
      if (!word) return word
      if (word.length <= 4 && word === word.toUpperCase()) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(" ")
}

const FILLER_PREFIXES = [
  /^(i\s+)?(want|need|would\s+like|am\s+looking\s+for|need\s+help\s+(to|with))\s+/i,
  /^(please|can\s+you|could\s+you|help\s+me|i\s+want\s+to)\s+/i,
  /^(create|build|design|make|generate|develop|craft)\s+/i,
  /^(a|an|the)\s+/i,
]

const SHORT_WORD_SUFFIXES = [
  "Studio", "Lab", "Hub", "Space", "Kit",
  "Flow", "Craft", "Forge", "Vault", "Nest",
]

export function deriveProjectNameFromPrompt(prompt?: string | null, fallback = DEFAULT_PROJECT_NAME): string {
  if (!prompt) return fallback

  const firstSentence = prompt
    .replace(/[`"']/g, "")
    .split(/\n|[.!?]/)
    .map((part) => part.trim())
    .find(Boolean)

  if (!firstSentence) return fallback

  let stripped = firstSentence
  for (const prefix of FILLER_PREFIXES) {
    stripped = stripped.replace(prefix, "")
  }

  stripped = stripped
    .replace(/\b(with|including|featuring|that includes|which includes)\b[\s\S]*$/i, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")

  const trimmed = collapseWhitespace(stripped)
  if (!trimmed) return fallback

  const words = trimmed.split(" ")
  const concise = words.slice(0, 8).join(" ")

  // ponytail: If the derived name is short (≤2 words), append a suffix so
  // consecutive short prompts get distinct names. The seed picks from a
  // fixed list rather than anything random so the result is deterministic.
  let name = normalizeProjectName(toTitleCase(concise), fallback)
  if (name === fallback || name.split(" ").length <= 2) {
    const seed = [...prompt].reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const suffix = SHORT_WORD_SUFFIXES[seed % SHORT_WORD_SUFFIXES.length]
    name = name === fallback ? `${name} ${suffix}` : `${name} ${suffix}`
  }

  return name
}
