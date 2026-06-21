import { describe, expect, it } from "vitest"

import { normalizeHtml } from "@/lib/reprompting/normalize-html"

describe("UT-30 normalizeHtml", () => {
  describe("Determinism", () => {
    it("produces a stable output for a typical AI-generated page", () => {
      const input = `<!DOCTYPE html><html><body><main><h1>Hi</h1><p>Body</p></main></body></html>`

      const first = normalizeHtml(input)

      expect(first).toBe(`<!DOCTYPE html>
<html>
  <head></head>
  <body>
    <main>
      <h1>Hi</h1>
      <p>Body</p>
    </main>
  </body>
</html>
`)
    })

    it("is idempotent — normalize(normalize(x)) === normalize(x)", () => {
      const input = `<!DOCTYPE html>
<html>
  <body>
    <main>
      <h1>Updated heading</h1>
      <p>Updated copy.</p>
    </main>
  </body>
</html>`

      const once = normalizeHtml(input)
      const twice = normalizeHtml(once)

      expect(twice).toBe(once)
    })

    it("ends with exactly one trailing newline", () => {
      const a = normalizeHtml(`<!DOCTYPE html><html><body><h1>Hi</h1></body></html>`)
      const b = normalizeHtml(`<!DOCTYPE html><html><body><h1>Hi</h1></body></html>\n\n\n`)

      expect(a.endsWith("\n")).toBe(true)
      expect(a.endsWith("\n\n")).toBe(false)
      expect(b).toBe(a)
    })
  })

  describe("Attribute handling", () => {
    it("preserves attribute order verbatim (Tailwind class order matters)", () => {
      const input = `<!DOCTYPE html><html><body><div class="text-red-500 text-blue-500" id="x" data-test="y"></div></body></html>`

      const out = normalizeHtml(input)

      expect(out).toContain(`<div class="text-red-500 text-blue-500" id="x" data-test="y">`)
    })

    it("escapes ampersands and quotes inside attribute values", () => {
      const input = `<!DOCTYPE html><html><body><a title='Tom & Jerry "rules"'>x</a></body></html>`

      const out = normalizeHtml(input)

      expect(out).toContain(`title="Tom &amp; Jerry &quot;rules&quot;"`)
    })

    it("emits boolean attributes without an empty quoted value", () => {
      const input = `<!DOCTYPE html><html><body><input type="checkbox" disabled></body></html>`

      const out = normalizeHtml(input)

      expect(out).toContain(`<input type="checkbox" disabled>`)
      expect(out).not.toContain(`disabled=""`)
    })
  })

  describe("Raw-text elements", () => {
    it("preserves <pre> contents byte-for-byte", () => {
      const inner = `line 1\n  line 2\n    line 3`
      const input = `<!DOCTYPE html><html><body><pre>${inner}</pre></body></html>`

      const out = normalizeHtml(input)

      expect(out).toContain(inner)
    })

    it("preserves <script> body verbatim including indentation", () => {
      const script = `\n  function add(a, b) {\n    return a + b;\n  }\n`
      const input = `<!DOCTYPE html><html><head><script>${script}</script></head><body></body></html>`

      const out = normalizeHtml(input)

      expect(out).toContain(script)
    })

    it("beautifies <style> CSS into readable multi-line form", () => {
      const css = `\n  body { margin: 0; }\n  h1 { color: red; }\n`
      const input = `<!DOCTYPE html><html><head><style>${css}</style></head><body></body></html>`

      const out = normalizeHtml(input)

      // CSS is beautified — each rule on its own line with indented declarations.
      expect(out).toContain("body {")
      expect(out).toContain("  margin: 0;")
      expect(out).toContain("h1 {")
      expect(out).toContain("  color: red;")
    })

    it("beautifyCss is idempotent", () => {
      const input = `<!DOCTYPE html><html><head><style>body{margin:0}h1{color:red}</style></head><body></body></html>`
      const first = normalizeHtml(input)
      const second = normalizeHtml(first)
      expect(second).toBe(first)
    })
  })

  describe("Inline element handling", () => {
    it("keeps inline children on the same line as their parent", () => {
      const input = `<!DOCTYPE html><html><body><h1>Hi <span>world</span></h1></body></html>`

      const out = normalizeHtml(input)

      expect(out).toContain(`<h1>Hi <span>world</span></h1>`)
    })

    it("breaks the parent across lines once a child is a block element", () => {
      const input = `<!DOCTYPE html><html><body><div><p>One</p><p>Two</p></div></body></html>`

      const out = normalizeHtml(input)

      expect(out).toContain(`    <div>\n      <p>One</p>\n      <p>Two</p>\n    </div>`)
    })
  })

  describe("Void elements", () => {
    it("emits void elements without a closing tag and without a slash", () => {
      const input = `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/x.css"></head><body><br></body></html>`

      const out = normalizeHtml(input)

      expect(out).toContain(`<meta charset="utf-8">`)
      expect(out).toContain(`<link rel="stylesheet" href="/x.css">`)
      expect(out).toContain(`<br>`)
      expect(out).not.toContain(`<meta charset="utf-8" />`)
      expect(out).not.toContain(`<br/>`)
    })
  })

  describe("Doctype", () => {
    it("emits the canonical HTML5 doctype", () => {
      const input = `<!DOCTYPE html><html><body></body></html>`

      const out = normalizeHtml(input)

      expect(out.startsWith(`<!DOCTYPE html>\n`)).toBe(true)
    })
  })

  describe("Robustness", () => {
    it("returns the input unchanged for empty strings", () => {
      expect(normalizeHtml("")).toBe("")
    })

    it("does not throw on partially malformed input — falls back gracefully", () => {
      // parse5 always returns a tree, so this still emits something sensible
      // rather than throwing. The contract is "never block on a normalizer
      // bug" — equivalent to returning the input unchanged.
      const input = `<!DOCTYPE html><html><body><h1>Half`
      expect(() => normalizeHtml(input)).not.toThrow()
    })
  })
})
