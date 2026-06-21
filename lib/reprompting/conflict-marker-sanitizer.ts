/**
 * Strips git-style conflict markers from complete HTML documents.
 *
 * Models (especially Grok Build 0.1) sometimes emit literal conflict markers
 * like `<<<<<<< PROJECT_NAME_START` / `>>>>>>> PROJECT_NAME_END` inline in
 * the HTML body. These leak through because `isCompleteHtmlDocument` still
 * passes and the StreamParser has already extracted what it needs.
 *
 * This sanitizer runs ONLY on finalized HTML (after patch application), never
 * on the raw streaming aggregate while the parser still needs it.
 *
 * IMPORTANT INVARIANT: Call this on the finalized HTML document, not on the
 * raw aggregate content while the StreamParser is still parsing patches.
 */

import {
  SEARCH_START,
  DIVIDER,
  REPLACE_END,
  UPDATE_FILE_START,
  UPDATE_FILE_END,
  PROJECT_NAME_START,
  PROJECT_NAME_END,
  NEW_FILE_START,
  NEW_FILE_END,
} from "@/lib/constants"

// Known marker pairs from lib/constants.ts
const KNOWN_MARKER_PAIRS: Array<[string, string]> = [
  [SEARCH_START, REPLACE_END],
  [UPDATE_FILE_START, UPDATE_FILE_END],
  [PROJECT_NAME_START, PROJECT_NAME_END],
  [NEW_FILE_START, NEW_FILE_END],
]

// Generic git-style conflict marker pattern for any unknown markers.
// Matches: <<<<<<< LABEL ... ======= ... >>>>>>> LABEL
const GENERIC_CONFLICT_REGEX = /<<<<<<<[ \t]*\S*[\s\S]*?\n>>>>>>>[^\n]*/g

/**
 * Strip all known and generic conflict markers from an HTML string.
 * Returns the sanitized HTML with markers removed.
 */
export function sanitizeConflictMarkers(html: string): string {
  let result = html

  // Strip known marker pairs: <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE, etc.
  for (const [startMarker, endMarker] of KNOWN_MARKER_PAIRS) {
    const escapedStart = escapeRegExp(startMarker)
    const escapedDivider = escapeRegExp(DIVIDER)
    const escapedEnd = escapeRegExp(endMarker)

    // Match: <<<<<<< START\n ... \n=======\n ... \n>>>>>>> END
    const regex = new RegExp(
      `${escapedStart}\\n[\\s\\S]*?\\n${escapedDivider}\\n[\\s\\S]*?\\n${escapedEnd}`,
      "g",
    )
    result = result.replace(regex, "")
  }

  // Also handle the case where DIVIDER appears without a newline before it
  for (const [startMarker, endMarker] of KNOWN_MARKER_PAIRS) {
    const escapedStart = escapeRegExp(startMarker)
    const escapedEnd = escapeRegExp(endMarker)

    const regex = new RegExp(
      `${escapedStart}[\\s\\S]*?${escapedEnd}`,
      "g",
    )
    result = result.replace(regex, "")
  }

  // Strip any generic git-style conflict markers that may have leaked through
  // (e.g. stray <<<<<<< HEAD ... >>>>>>> branch-name)
  result = result.replace(GENERIC_CONFLICT_REGEX, "")

  return result
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Line-anchored conflict-marker prefixes from lib/constants.ts.
 * Matches any line that is exactly a marker line (optionally indented):
 *   <<<<<<< SEARCH / <<<<<<< UPDATE_FILE_START / <<<<<<< PROJECT_NAME_START / <<<<<<< NEW_FILE_START
 *   >>>>>>> REPLACE / >>>>>>> UPDATE_FILE_END   / >>>>>>> PROJECT_NAME_END   / >>>>>>> NEW_FILE_END
 *   =======  (the SEARCH/REPLACE divider — only when it is a standalone marker line)
 *
 * IMPORTANT: this strips only the marker LINES, keeping the content between
 * them. Use this for live draft display so the user still sees in-flight
 * content while the StreamParser is parsing patches. For finalized HTML use
 * `sanitizeConflictMarkers` (which strips whole blocks).
 *
 * ponytail: the `={7}` divider is ambiguous — a standalone line of seven
 * equals signs is almost always a SEARCH/REPLACE divider in this app's
 * protocol, but a line of `=======` inside an HTML comment or <style> block
 * could theoretically be legitimate content. The full-line anchor + 7-char
 * minimum makes false positives vanishingly rare; if it ever bites, upgrade
 * to only stripping dividers that sit between a `<<<<<<<` and `>>>>>>>` line.
 */
const CONFLICT_MARKER_LINE_REGEX = /^[ \t]*(?:<{7}[^\n]*|>{7}[^\n]*|={7}[ \t]*)$/gm

export function stripConflictMarkerLines(content: string): string {
  if (!content) return content
  const stripped = content.replace(CONFLICT_MARKER_LINE_REGEX, "")
  // Collapse runs of blank lines left behind by removed marker lines.
  return stripped.replace(/\n{3,}/g, "\n\n")
}
