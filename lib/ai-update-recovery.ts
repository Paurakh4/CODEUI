export type PatchFailureKind =
  | "unsupported-target"
  | "invalid-document"
  | "search-replace-failed"
  | "response-validation-failed"

export interface PatchFailureContext {
  kind: PatchFailureKind
  filePath?: string
  detail?: string
}

export const GENERIC_TARGETED_UPDATE_FAILURE_MESSAGE =
  "Could not finish the targeted update automatically. The previous page was restored. Try a more explicit follow-up request."

export const FULL_DOCUMENT_RECOVERY_FAILURE_MESSAGE =
  "Could not recover the update automatically. Try a smaller, more specific follow-up request."

export function isCompleteHtmlDocument(value: string | null | undefined): boolean {
  const normalized = value?.trim()
  if (!normalized) {
    return false
  }

  return /<!DOCTYPE|<html\b/i.test(normalized) && /<\/html>/i.test(normalized)
}

export function selectStableHtmlDocument(
  candidates: Array<string | null | undefined>,
  fallback: string,
): string {
  for (const candidate of candidates) {
    if (isCompleteHtmlDocument(candidate)) {
      return candidate.trim()
    }
  }

  return fallback.trim()
}

export function describeTargetedUpdateFailure(context?: PatchFailureContext | null): string {
  if (!context) {
    return GENERIC_TARGETED_UPDATE_FAILURE_MESSAGE
  }

  switch (context.kind) {
    case "unsupported-target":
      return `Could not finish the targeted update automatically. Targeted follow-up edits can only patch index.html, but the model tried to update ${context.filePath || "another file"}. The previous page was restored. Try a more explicit follow-up request.`
    case "invalid-document":
      return "Could not finish the targeted update automatically. The generated patch produced an incomplete HTML document, so the previous page was restored. Try a more explicit follow-up request."
    case "search-replace-failed":
      return "Could not finish the targeted update automatically. The generated patch no longer matched the current page structure, so the previous page was restored. Try a more explicit follow-up request."
    case "response-validation-failed":
      return `Could not finish the targeted update automatically. ${context.detail || "The model returned an invalid response"}, so the previous page was restored. Try a more explicit follow-up request.`
    default:
      return GENERIC_TARGETED_UPDATE_FAILURE_MESSAGE
  }
}
