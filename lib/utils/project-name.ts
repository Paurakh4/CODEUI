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

export function deriveProjectNameFromPrompt(prompt?: string | null, fallback = DEFAULT_PROJECT_NAME): string {
  if (!prompt) return fallback

  const firstSentence = prompt
    .replace(/[`"']/g, "")
    .split(/\n|[.!?]/)
    .map((part) => part.trim())
    .find(Boolean)

  if (!firstSentence) return fallback

  const stripped = firstSentence
    .replace(/^(create|build|design|make|generate|develop|craft)\s+/i, "")
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\b(with|including|featuring|that includes|which includes)\b[\s\S]*$/i, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")

  const trimmed = collapseWhitespace(stripped)
  if (!trimmed) return fallback

  const concise = trimmed.split(" ").slice(0, 6).join(" ")
  return normalizeProjectName(toTitleCase(concise), fallback)
}
