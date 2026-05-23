import { describe, expect, it } from "vitest"

import { finalizeFollowUpResponse } from "@/lib/reprompting/follow-up-finalizer"

const COMPLETE_HTML = `<!DOCTYPE html>
<html>
  <body>
    <main>
      <h1>Updated heading</h1>
      <p>Updated copy.</p>
    </main>
  </body>
</html>`

const PRIOR_HTML = `<!DOCTYPE html>
<html>
  <body>
    <main>
      <h1>Original heading</h1>
      <p>Original copy.</p>
    </main>
  </body>
</html>`

describe("UT-29 follow-up finalizer", () => {
  describe("Gemini-style clean output", () => {
    it("passes through a complete HTML document untouched", () => {
      const result = finalizeFollowUpResponse({
        rawContent: COMPLETE_HTML,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("passthrough")
      expect(result.html).toBe(COMPLETE_HTML)
    })

    it("trims surrounding whitespace from a passthrough document", () => {
      const result = finalizeFollowUpResponse({
        rawContent: `\n\n${COMPLETE_HTML}\n\n`,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.html).toBe(COMPLETE_HTML)
    })
  })

  describe("Thinking-model output (DeepSeek R1, Kimi K2 Thinking, GLM 4.7)", () => {
    it("strips <think>...</think> blocks before the document", () => {
      const raw = `<think>The user wants a light theme. I need to update the body background.</think>\n${COMPLETE_HTML}`

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("stripped-thinking")
      expect(result.html).toBe(COMPLETE_HTML)
      expect(result.html).not.toContain("<think>")
    })

    it("strips multiple thinking tag variants", () => {
      const raw = `<reasoning>Step 1: parse request.</reasoning>
<reflection>Be careful with edge cases.</reflection>
${COMPLETE_HTML}`

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.html).toBe(COMPLETE_HTML)
    })

    it("recovers when an open <think> tag is left dangling before the doctype", () => {
      const raw = `<think>I should change the heading...
Then update copy.

${COMPLETE_HTML}`

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.html).toBe(COMPLETE_HTML)
    })
  })

  describe("Markdown-fenced output (OpenAI, Mistral, some Anthropic models)", () => {
    it("unwraps a ```html fenced block", () => {
      const raw = `\`\`\`html\n${COMPLETE_HTML}\n\`\`\``

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("fenced-block")
      expect(result.html).toBe(COMPLETE_HTML)
    })

    it("unwraps an unlabeled fenced block", () => {
      const raw = `Here is the updated page:\n\n\`\`\`\n${COMPLETE_HTML}\n\`\`\``

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.html).toBe(COMPLETE_HTML)
    })

    it("recovers a fenced block whose closing fence was truncated", () => {
      const raw = `\`\`\`html\n${COMPLETE_HTML}`

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.html).toBe(COMPLETE_HTML)
    })

    it("picks the largest fenced HTML block when multiple are present", () => {
      const smallSnippet = `<!DOCTYPE html><html><body>Small</body></html>`
      const raw = `Before:\n\`\`\`html\n${smallSnippet}\n\`\`\`\nAfter the big update:\n\`\`\`html\n${COMPLETE_HTML}\n\`\`\``

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.html).toBe(COMPLETE_HTML)
    })
  })

  describe("Narration-wrapped output", () => {
    it("extracts the document from leading narration", () => {
      const raw = `Sure! Here is the updated page with the change you asked for:\n\n${COMPLETE_HTML}\n\nLet me know if you want anything else!`

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("extracted-from-narration")
      expect(result.html).toBe(COMPLETE_HTML)
    })
  })

  describe("Patch-format output (DeepSeek-Chat, Devstral)", () => {
    it("applies a SEARCH/REPLACE patch against the current document", () => {
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
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("search-replace")
      expect(result.appliedPatchCount).toBe(2)
      expect(result.html).toContain("Updated heading")
      expect(result.html).toContain("Updated copy")
      expect(result.html).not.toContain("Original heading")
      expect(result.html).toMatch(/^<!DOCTYPE html>/)
      expect(result.html).toMatch(/<\/html>\s*$/)
    })

    it("falls back to patches when narration mixes with patch blocks", () => {
      const raw = `Here are the changes:

<<<<<<< SEARCH
<h1>Original heading</h1>
=======
<h1>Updated heading</h1>
>>>>>>> REPLACE

That's all I changed.`

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.strategy).toBe("search-replace")
      expect(result.html).toContain("Updated heading")
    })

    it("rejects patches when none of them match the current document", () => {
      const raw = `<<<<<<< SEARCH
This text never existed in the document
=======
Replacement
>>>>>>> REPLACE`

      const result = finalizeFollowUpResponse({
        rawContent: raw,
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toMatch(/patches/i)
    })
  })

  describe("Failure modes", () => {
    it("rejects empty output", () => {
      const result = finalizeFollowUpResponse({
        rawContent: "   \n  ",
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(false)
    })

    it("rejects narration without any HTML or patches", () => {
      const result = finalizeFollowUpResponse({
        rawContent: "I have completed the requested update.",
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(false)
    })

    it("reports an incomplete HTML document specifically", () => {
      const result = finalizeFollowUpResponse({
        rawContent: "<!DOCTYPE html><html><body><h1>Half</h1>",
        currentHtml: PRIOR_HTML,
      })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toMatch(/incomplete html/i)
    })
  })
})
