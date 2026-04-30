import { describe, expect, it } from "vitest"

import {
  getAtomicFollowUpOutputIssue,
  hasCompleteHtmlDocument,
  hasStructuredPatchMarkers,
} from "@/lib/reprompting/atomic-follow-up"

describe("UT-09 atomic follow-up output validation", () => {
  it("accepts complete HTML documents", () => {
    const html = "<!DOCTYPE html><html><head><title>x</title></head><body>Done</body></html>"

    expect(hasCompleteHtmlDocument(html)).toBe(true)
    expect(getAtomicFollowUpOutputIssue(html)).toBeNull()
  })

  it("rejects empty follow-up output", () => {
    expect(getAtomicFollowUpOutputIssue("  \n\t  ")).toBe("The model returned an empty follow-up response.")
  })

  it("rejects incomplete patch output before it can reach the editor", () => {
    const output = "<<<<<<< SEARCH\n<body>old</body>\n=======\n<body>new</body>"

    expect(getAtomicFollowUpOutputIssue(output)).toContain("incomplete patch response")
  })

  it("rejects complete patch markers because follow-ups require full documents", () => {
    const output = "<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE"

    expect(hasStructuredPatchMarkers(output)).toBe(true)
    expect(getAtomicFollowUpOutputIssue(output)).toContain("patch markers")
  })

  it("rejects narration without actionable HTML", () => {
    expect(getAtomicFollowUpOutputIssue("Here is the updated light mode version.")).toContain("narration")
  })

  it("rejects HTML fragments that are not complete documents", () => {
    expect(getAtomicFollowUpOutputIssue("<main>Updated section</main>")).toBe(
      "The model did not return a complete HTML document.",
    )
  })
})