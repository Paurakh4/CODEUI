import { describe, expect, it } from "vitest"
import {
  sanitizeConflictMarkers,
  stripConflictMarkerLines,
} from "@/lib/reprompting/conflict-marker-sanitizer"
import {
  SEARCH_START,
  DIVIDER,
  REPLACE_END,
  UPDATE_FILE_START,
  UPDATE_FILE_END,
} from "@/lib/constants"

describe("stripConflictMarkerLines", () => {
  it("strips SEARCH/REPLACE marker lines but keeps the content between them", () => {
    const input = [
      "some preamble",
      SEARCH_START,
      "<div class=\"hero\">Keep me</div>",
      DIVIDER,
      "<div class=\"hero\">Keep me</div>",
      REPLACE_END,
      "trailing text",
    ].join("\n")

    expect(stripConflictMarkerLines(input)).toBe(
      [
        "some preamble",
        "",
        "<div class=\"hero\">Keep me</div>",
        "",
        "<div class=\"hero\">Keep me</div>",
        "",
        "trailing text",
      ].join("\n"),
    )
  })

  it("strips UPDATE_FILE wrapper marker lines", () => {
    const input = [
      UPDATE_FILE_START,
      "index.html",
      UPDATE_FILE_END,
      "<p>content</p>",
    ].join("\n")

    const result = stripConflictMarkerLines(input)
    expect(result).not.toContain(UPDATE_FILE_START)
    expect(result).not.toContain(UPDATE_FILE_END)
    expect(result).toContain("index.html")
    expect(result).toContain("<p>content</p>")
  })

  it("handles partial mid-stream state (opening marker present, closing not yet arrived)", () => {
    // Stream truncated mid-patch: only the SEARCH start + divider arrived.
    const partial = [
      "<html>",
      SEARCH_START,
      "<div>old</div>",
      DIVIDER,
      "<div>new</div>",
    ].join("\n")

    const result = stripConflictMarkerLines(partial)
    expect(result).not.toContain(SEARCH_START)
    expect(result).not.toContain(DIVIDER)
    expect(result).toContain("<div>old</div>")
    expect(result).toContain("<div>new</div>")
    expect(result).toContain("<html>")
  })

  it("leaves a ======= that is NOT exactly seven equals alone on a line", () => {
    // Eight equals signs or trailing content should not match the divider regex.
    const content = "rule: a ======== b\nalso: =======text"
    expect(stripConflictMarkerLines(content)).toBe(content)
  })

  it("collapses runs of blank lines left by removed markers", () => {
    const input = [
      "before",
      SEARCH_START,
      DIVIDER,
      REPLACE_END,
      "after",
    ].join("\n")

    // Three consecutive marker lines removed would leave 3+ blank lines
    // without the collapse step.
    const result = stripConflictMarkerLines(input)
    expect(result).not.toMatch(/\n{3,}/)
    expect(result).toContain("before")
    expect(result).toContain("after")
  })

  it("tolerates leading whitespace on marker lines", () => {
    const input = `text\n  ${SEARCH_START}\n  <p>x</p>\n  ${DIVIDER}\n  <p>y</p>\n  ${REPLACE_END}\nend`
    const result = stripConflictMarkerLines(input)
    expect(result).not.toContain(SEARCH_START)
    expect(result).not.toContain(DIVIDER)
    expect(result).not.toContain(REPLACE_END)
    expect(result).toContain("<p>x</p>")
    expect(result).toContain("<p>y</p>")
  })

  it("is a no-op on content with no markers", () => {
    const html = "<!DOCTYPE html><html><body><h1>Hi</h1></body></html>"
    expect(stripConflictMarkerLines(html)).toBe(html)
  })

  it("returns empty input unchanged", () => {
    expect(stripConflictMarkerLines("")).toBe("")
  })
})

describe("sanitizeConflictMarkers (regression guard)", () => {
  it("still strips whole SEARCH/REPLACE blocks from finalized HTML", () => {
    const html = [
      "<html>",
      SEARCH_START,
      "<div>old</div>",
      DIVIDER,
      "<div>new</div>",
      REPLACE_END,
      "</html>",
    ].join("\n")

    const result = sanitizeConflictMarkers(html)
    expect(result).not.toContain(SEARCH_START)
    expect(result).not.toContain(DIVIDER)
    expect(result).not.toContain(REPLACE_END)
    // Whole-block strip removes the entire SEARCH...REPLACE span (both sides).
    expect(result).not.toContain("<div>old</div>")
    expect(result).not.toContain("<div>new</div>")
    expect(result).toContain("<html>")
    expect(result).toContain("</html>")
  })
})
