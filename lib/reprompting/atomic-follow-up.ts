import {
  NEW_FILE_START,
  PROJECT_NAME_START,
  SEARCH_START,
  UPDATE_FILE_START,
} from "@/lib/constants"
import { detectIncompletePatchBlocks, validateAIResponse } from "@/lib/parsers/stream-parser"

export function hasCompleteHtmlDocument(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) {
    return false
  }

  const hasRoot = trimmed.includes("<!DOCTYPE") || trimmed.includes("<html")
  return hasRoot && trimmed.includes("</html>")
}

export function hasStructuredPatchMarkers(content: string): boolean {
  return (
    content.includes(SEARCH_START) ||
    content.includes(UPDATE_FILE_START) ||
    content.includes(NEW_FILE_START) ||
    content.includes(PROJECT_NAME_START)
  )
}

export function getAtomicFollowUpOutputIssue(content: string): string | null {
  const trimmed = content.trim()
  if (!trimmed) {
    return "The model returned an empty follow-up response."
  }

  if (detectIncompletePatchBlocks(content) > 0) {
    return "The model returned an incomplete patch response instead of a complete HTML document."
  }

  if (hasStructuredPatchMarkers(content)) {
    return "The model returned patch markers instead of a complete HTML document."
  }

  const validation = validateAIResponse(content)
  if (!validation.valid) {
    return validation.reason ?? "The model response was not actionable."
  }

  if (!hasCompleteHtmlDocument(content)) {
    return "The model did not return a complete HTML document."
  }

  return null
}