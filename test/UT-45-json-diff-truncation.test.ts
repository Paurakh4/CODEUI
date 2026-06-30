import { describe, expect, it } from "vitest"

import { parseJsonDiff } from "@/lib/reprompting/json-diff-parser"
import { finalizeFollowUpResponse } from "@/lib/reprompting/follow-up-finalizer"

const PRIOR_HTML = `<!DOCTYPE html>
<html>
  <body>
    <main>
      <h1>Original heading</h1>
      <p>Original copy.</p>
      <button class="btn-primary">Click me</button>
    </main>
  </body>
</html>`

describe("UT-45 JSON diff truncation scenarios", () => {
  describe("parseJsonDiff salvage mode", () => {
    it("salvages complete edits from truncated JSON (cut mid-object)", () => {
      // Simulates model output truncated mid-object due to token limits.
      // Two complete edits were emitted, then the third was cut.
      const truncated = `{"edits":[{"search":"<h1>Original heading</h1>","replace":"<h1>Updated heading</h1>"},{"search":"<p>Original copy.</p>","replace":"<p>Updated copy.</p>"},{"search":"<button class=\\"btn-primary\\">Click`

      const result = parseJsonDiff(truncated)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(2)
      expect(result!.edits[0].search).toBe("<h1>Original heading</h1>")
      expect(result!.edits[0].replace).toBe("<h1>Updated heading</h1>")
      expect(result!.edits[1].search).toBe("<p>Original copy.</p>")
      expect(result!.edits[1].replace).toBe("<p>Updated copy.</p>")
    })

    it("salvages edits from two concatenated JSON objects (broken continuation)", () => {
      // Simulates what happens when continuation produces a second complete
      // JSON object that concatenates with the truncated first part.
      const concatenated =
        `{"edits":[{"search":"<h1>Original heading</h1>","replace":"<h1>Updated heading</h1>"},` +
        `{"edits":[{"search":"<p>Original copy.</p>","replace":"<p>Updated copy.</p>"},{"search":"<button class=\\"btn-primary\\">Click me</button>","replace":"<button class=\\"btn-secondary\\">Submit</button>"}]}`

      const result = parseJsonDiff(concatenated)
      expect(result).not.toBeNull()
      expect(result!.edits.length).toBeGreaterThanOrEqual(2)
      // Should contain edits from both JSON objects
      const allSearches = result!.edits.map((e) => e.search)
      expect(allSearches).toContain("<h1>Original heading</h1>")
      expect(allSearches).toContain("<p>Original copy.</p>")
      expect(allSearches).toContain('<button class="btn-primary">Click me</button>')
    })

    it("handles escaped quotes and newlines in salvaged edits", () => {
      const truncated =
        `{"edits":[{"search":"<h1>Original\\nheading</h1>","replace":"<h1>Updated\\nheading</h1>"},` +
        `{"search":"<p class=\\"old\\">Text</p>","replace":"<p class=\\"new\\">Text</p>"}`

      const result = parseJsonDiff(truncated)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(2)
      expect(result!.edits[0].search).toBe("<h1>Original\nheading</h1>")
      expect(result!.edits[0].replace).toBe("<h1>Updated\nheading</h1>")
      expect(result!.edits[1].search).toBe('<p class="old">Text</p>')
      expect(result!.edits[1].replace).toBe('<p class="new">Text</p>')
    })

    it("handles replace/search key order in salvaged edits", () => {
      // Some models emit replace before search
      const content = `{"edits":[{"replace":"<h1>Updated</h1>","search":"<h1>Original</h1>"}]}`

      const result = parseJsonDiff(content)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(1)
      expect(result!.edits[0].search).toBe("<h1>Original</h1>")
      expect(result!.edits[0].replace).toBe("<h1>Updated</h1>")
    })

    it("returns null when no complete edit objects exist in truncated JSON", () => {
      // Everything was cut mid-object — no complete edits to salvage.
      const truncated = `{"edits":[{"search":"<h1>Orig`

      const result = parseJsonDiff(truncated)
      expect(result).toBeNull()
    })

    it("returns null for non-JSON content with no edit objects", () => {
      expect(parseJsonDiff("Just some plain text without any JSON")).toBeNull()
    })

    it("salvages edits from JSON wrapped in thinking tags (truncated)", () => {
      const truncated =
        `<thinking>Let me analyze this.</thinking>` +
        `{"edits":[{"search":"<h1>Original heading</h1>","replace":"<h1>Updated heading</h1>"},` +
        `{"search":"<p>Origi`

      const result = parseJsonDiff(truncated)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(1)
      expect(result!.edits[0].search).toBe("<h1>Original heading</h1>")
    })

    it("salvages edits from JSON with extra whitespace between keys", () => {
      const content = `{"edits":[{  "search"  :  "<h1>Original heading</h1>"  ,  "replace"  :  "<h1>Updated heading</h1>"  }]}`

      const result = parseJsonDiff(content)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(1)
      expect(result!.edits[0].search).toBe("<h1>Original heading</h1>")
      expect(result!.edits[0].replace).toBe("<h1>Updated heading</h1>")
    })
  })

  describe("finalizeFollowUpResponse with truncated JSON diff", () => {
    it("applies salvaged edits from truncated JSON", () => {
      const truncated = `{"edits":[` +
        `{"search":"<h1>Original heading</h1>","replace":"<h1>Updated heading</h1>"},` +
        `{"search":"<p>Original copy.</p>","replace":"<p>Updated copy.</p>"},` +
        `{"search":"<button class=\\"btn-primary\\">Cl`

      const result = finalizeFollowUpResponse({
        rawContent: truncated,
        currentHtml: PRIOR_HTML,
        preferJsonDiff: true,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("json-diff")
      expect(result.html).toContain("Updated heading")
      expect(result.html).toContain("Updated copy")
      // Button was in the truncated part — should remain unchanged
      expect(result.html).toContain("Click me")
    })

    it("applies salvaged edits from concatenated JSON (broken continuation)", () => {
      const concatenated =
        `{"edits":[{"search":"<h1>Original heading</h1>","replace":"<h1>Updated heading</h1>"},` +
        `{"edits":[{"search":"<p>Original copy.</p>","replace":"<p>Updated copy.</p>"}]}`

      const result = finalizeFollowUpResponse({
        rawContent: concatenated,
        currentHtml: PRIOR_HTML,
        preferJsonDiff: true,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("json-diff")
      expect(result.html).toContain("Updated heading")
      expect(result.html).toContain("Updated copy")
    })

    it("falls back to repair when no edits can be salvaged", () => {
      const truncated = `{"edits":[{"search":"<h1>Orig`

      const result = finalizeFollowUpResponse({
        rawContent: truncated,
        currentHtml: PRIOR_HTML,
        preferJsonDiff: true,
      })

      expect(result.ok).toBe(false)
    })

    it("handles large edit with many salvaged objects", () => {
      // Simulate a large response with many edits where the last one is truncated
      const edits = []
      for (let i = 0; i < 10; i++) {
        edits.push(`{"search":"<span class=\\"item-${i}\\">Item ${i}</span>","replace":"<span class=\\"item-${i} updated\\">Item ${i} Updated</span>"}`)
      }
      const truncated = `{"edits":[${edits.join(",")},{"search":"<div class=\\"trunca`

      const result = parseJsonDiff(truncated)
      expect(result).not.toBeNull()
      expect(result!.edits).toHaveLength(10)
      expect(result!.edits[0].search).toBe('<span class="item-0">Item 0</span>')
      expect(result!.edits[0].replace).toBe('<span class="item-0 updated">Item 0 Updated</span>')
      expect(result!.edits[9].search).toBe('<span class="item-9">Item 9</span>')
    })
  })
})
