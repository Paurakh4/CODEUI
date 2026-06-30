import { describe, expect, it } from "vitest"

import { finalizeFollowUpResponse } from "@/lib/reprompting/follow-up-finalizer"
import { parseJsonDiff } from "@/lib/reprompting/json-diff-parser"

const PRIOR_HTML = `<!DOCTYPE html>
<html>
  <body>
    <main>
      <h1>Original heading</h1>
      <p>Original copy.</p>
    </main>
  </body>
</html>`

const EXPECTED_NORMALIZED = `<!DOCTYPE html>
<html>
  <head></head>
  <body>
    <main>
      <h1>Updated heading</h1>
      <p>Updated copy.</p>
    </main>
  </body>
</html>
`

describe("UT-44 JSON diff finalizer", () => {
  describe("parseJsonDiff", () => {
    it("parses clean JSON with edits array", () => {
      const raw = JSON.stringify({
        edits: [
          { search: "<h1>Original heading</h1>", replace: "<h1>Updated heading</h1>" },
          { search: "<p>Original copy.</p>", replace: "<p>Updated copy.</p>" },
        ],
      })

      const result = parseJsonDiff(raw)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(2)
      expect(result!.edits[0].search).toBe("<h1>Original heading</h1>")
      expect(result!.edits[0].replace).toBe("<h1>Updated heading</h1>")
      expect(result!.skipped).toBe(0)
    })

    it("returns null for non-JSON text", () => {
      expect(parseJsonDiff("Just some plain text")).toBeNull()
    })

    it("returns null for JSON without edits array", () => {
      expect(parseJsonDiff(JSON.stringify({ foo: "bar" }))).toBeNull()
    })

    it("returns null for empty edits array", () => {
      expect(parseJsonDiff(JSON.stringify({ edits: [] }))).toBeNull()
    })

    it("skips malformed edit objects", () => {
      const raw = JSON.stringify({
        edits: [
          { search: "<h1>Original heading</h1>", replace: "<h1>Updated heading</h1>" },
          { search: 123, replace: "invalid" },
          { search: "valid", replace: "also valid" },
        ],
      })

      const result = parseJsonDiff(raw)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(2)
      expect(result!.skipped).toBe(1)
    })

    it("extracts JSON from markdown fences", () => {
      const raw = "```json\n" + JSON.stringify({
        edits: [{ search: "a", replace: "b" }],
      }) + "\n```"

      const result = parseJsonDiff(raw)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(1)
    })

    it("extracts JSON from surrounding narration", () => {
      const raw = "Here are the edits:\n" + JSON.stringify({
        edits: [{ search: "a", replace: "b" }],
      }) + "\nThat's all."

      const result = parseJsonDiff(raw)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(1)
    })

    it("strips thinking tags before parsing", () => {
      const raw = `<thinking>Let me analyze this.</thinking>` + JSON.stringify({
        edits: [{ search: "a", replace: "b" }],
      })

      const result = parseJsonDiff(raw)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(1)
    })
  })

  describe("finalizeFollowUpResponse with preferJsonDiff", () => {
    it("applies JSON diff edits and returns json-diff strategy", () => {
      const raw = JSON.stringify({
        edits: [
          { search: "<h1>Original heading</h1>", replace: "<h1>Updated heading</h1>" },
          { search: "<p>Original copy.</p>", replace: "<p>Updated copy.</p>" },
        ],
      })

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
        preferJsonDiff: true,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("json-diff")
      expect(result.appliedPatchCount).toBe(2)
      expect(result.diffCompliant).toBe(true)
      expect(result.html).toBe(EXPECTED_NORMALIZED)
    })

    it("falls back to text strategies when JSON parsing fails", () => {
      const completeHtml = `<!DOCTYPE html>
<html>
  <body>
    <main>
      <h1>Updated heading</h1>
      <p>Updated copy.</p>
    </main>
  </body>
</html>`

      const result = finalizeFollowUpResponse({
        rawContent: completeHtml,
        currentHtml: PRIOR_HTML,
        preferJsonDiff: true,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("passthrough")
    })

    it("falls back to SEARCH/REPLACE text patches when JSON diff fails", () => {
      const raw = `<<<<<<< SEARCH
<h1>Original heading</h1>
=======
<h1>Updated heading</h1>
>>>>>>> REPLACE

<<<<<<< SEARCH
<p>Original copy.</p>
=======
<p>Updated copy.</p>
>>>>>>> REPLACE`

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
        preferJsonDiff: true,
        preferPatches: true,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("search-replace")
      expect(result.html).toContain("Updated heading")
    })

    it("falls back to fenced block when JSON diff fails", () => {
      const completeHtml = `<!DOCTYPE html>
<html>
  <body>
    <main>
      <h1>Updated heading</h1>
      <p>Updated copy.</p>
    </main>
  </body>
</html>`

      const raw = "```html\n" + completeHtml + "\n```"

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
        preferJsonDiff: true,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("fenced-block")
    })

    it("rejects when JSON edits don't match current HTML", () => {
      const raw = JSON.stringify({
        edits: [
          { search: "This text does not exist", replace: "Replacement" },
        ],
      })

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
        preferJsonDiff: true,
      })

      expect(result.ok).toBe(false)
    })

    it("handles single edit", () => {
      const raw = JSON.stringify({
        edits: [
          { search: "<h1>Original heading</h1>", replace: "<h1>Updated heading</h1>" },
        ],
      })

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
        preferJsonDiff: true,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("json-diff")
      expect(result.appliedPatchCount).toBe(1)
      expect(result.html).toContain("Updated heading")
      expect(result.html).toContain("Original copy")
    })

    it("handles JSON wrapped in thinking tags", () => {
      const raw = `<thinking>I need to update the heading.</thinking>` + JSON.stringify({
        edits: [
          { search: "<h1>Original heading</h1>", replace: "<h1>Updated heading</h1>" },
        ],
      })

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
        preferJsonDiff: true,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("json-diff")
      expect(result.html).not.toContain("thinking")
    })
  })

  describe("backward compatibility (preferJsonDiff not set)", () => {
    it("does not try JSON diff when preferJsonDiff is not set", () => {
      const raw = JSON.stringify({
        edits: [
          { search: "<h1>Original heading</h1>", replace: "<h1>Updated heading</h1>" },
        ],
      })

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(false)
    })
  })
})
