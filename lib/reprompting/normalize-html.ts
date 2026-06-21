/**
 * Canonical, deterministic HTML normalizer used as the last step of the
 * follow-up finalizer pipeline.
 *
 * Why we don't use Prettier here:
 *   - Prettier upgrades have changed HTML output between minor versions.
 *     Our `search-replace` reprompt strategy diffs against the previously
 *     stored HTML, so any formatter drift produces spurious patches and
 *     breaks repeat reprompts after a dependency bump.
 *   - Prettier + html plugin is several MB on a serverless cold start.
 *     parse5 is ~100KB and fully spec-compliant.
 *   - Prettier can throw on partially malformed input. parse5 always
 *     returns a tree; the caller's finalizer has already vetted that the
 *     document is structurally complete.
 *   - We need to encode project-specific rules (preserve <pre>/<textarea>
 *     verbatim, never reorder Tailwind class names, keep data-* attributes
 *     untouched). Easier to express in a small in-house emitter than via
 *     Prettier configuration.
 *
 * Determinism guarantees this module makes:
 *   1. Idempotent — `normalize(normalize(x)) === normalize(x)`.
 *   2. Byte-stable across this module's lifetime. Output only changes when
 *      this file changes, which is gated by tests.
 *   3. Whitespace-preserving inside `<pre>`, `<textarea>`, `<script>`, and
 *      `<style>`. Text content of every other element is preserved as-is
 *      from parse5 (no reflow), only the surrounding indentation changes.
 *      For `<style>`, CSS is beautified to readable multi-line form via
 *      an idempotent beautifier so stored HTML is always human-readable.
 *   4. Attribute order is preserved exactly as parse5 reports it (which is
 *      source order). We never reorder attributes — class lists in
 *      particular must stay verbatim because Tailwind treats later classes
 *      as overriding earlier ones for conflicting utilities.
 */

import { parse, defaultTreeAdapter, DefaultTreeAdapterTypes } from "parse5"

type ChildNode = DefaultTreeAdapterTypes.ChildNode
type CommentNode = DefaultTreeAdapterTypes.CommentNode
type Document = DefaultTreeAdapterTypes.Document
type DocumentType = DefaultTreeAdapterTypes.DocumentType
type Element = DefaultTreeAdapterTypes.Element
type ParentNode = DefaultTreeAdapterTypes.ParentNode
type TextNode = DefaultTreeAdapterTypes.TextNode

const INDENT = "  "

/**
 * HTML5 void elements — emitted as `<tag>` with no closing tag.
 *
 * We do not emit XHTML-style self-closing slashes (`<br/>`). The HTML5 spec
 * treats them as ignored, but they regress `search-replace` patches that
 * were authored against the conventional form.
 */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
])

/**
 * Elements whose text content must be preserved byte-for-byte: any
 * indentation/whitespace inside them is semantically meaningful.
 */
const RAW_TEXT_ELEMENTS = new Set([
  "pre",
  "textarea",
  "script",
  "style",
  "code", // conservative: nested <pre><code> blocks are common
])

/**
 * Inline elements where introducing surrounding whitespace would change
 * the rendered output. We emit these on the same line as their context.
 */
const INLINE_ELEMENTS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
])

interface NormalizeOptions {
  /** Indentation unit. Defaults to two spaces. */
  indent?: string
}

/**
 * Normalize a complete HTML document into canonical form.
 *
 * Input requirements:
 *   - Must be a complete HTML document (the finalizer guarantees this).
 *   - Encoding-prefix-free (no BOM). The finalizer strips BOM upstream.
 *
 * On any unexpected error the original input is returned unchanged so a
 * normalization bug never blocks a successful generation.
 */
export function normalizeHtml(input: string, options: NormalizeOptions = {}): string {
  if (!input) return input

  const indent = options.indent ?? INDENT

  try {
    const document = parse(input)
    const emitter = new Emitter(indent)
    emitter.emitDocument(document)
    return emitter.toString()
  } catch {
    return input
  }
}

class Emitter {
  private out = ""
  private readonly indent: string

  constructor(indent: string) {
    this.indent = indent
  }

  toString(): string {
    return this.out
  }

  emitDocument(document: Document): void {
    const children = defaultTreeAdapter.getChildNodes(document) as ChildNode[]
    for (const child of children) {
      this.emitTopLevel(child)
    }
    // Always end with a single trailing newline. Editors and diff tools
    // expect this and it makes byte-equality checks robust.
    if (!this.out.endsWith("\n")) {
      this.out += "\n"
    }
  }

  private emitTopLevel(node: ChildNode): void {
    if (isDocumentType(node)) {
      this.writeLine(0, serializeDoctype(node))
      return
    }
    if (isElement(node)) {
      this.emitElement(node, 0)
      return
    }
    if (isCommentNode(node)) {
      this.writeLine(0, `<!--${node.data}-->`)
      return
    }
    if (isTextNode(node)) {
      const text = node.value
      if (text.trim().length === 0) return
      // Preserve any non-trivial top-level text exactly. We intentionally
      // do not collapse whitespace here. parse5 returns decoded text, so
      // we re-encode HTML-significant characters before emitting.
      this.writeLine(0, escapeText(text.trim()))
    }
  }

  private emitElement(element: Element, depth: number): void {
    const tagName = element.tagName.toLowerCase()
    const open = serializeOpenTag(element)

    if (VOID_ELEMENTS.has(tagName)) {
      this.writeLine(depth, open)
      return
    }

    if (RAW_TEXT_ELEMENTS.has(tagName)) {
      this.emitRawTextElement(element, depth, open)
      return
    }

    const children = defaultTreeAdapter.getChildNodes(element) as ChildNode[]
    const meaningful = filterMeaningfulChildren(children)

    if (meaningful.length === 0) {
      this.writeLine(depth, `${open}</${tagName}>`)
      return
    }

    if (canEmitInline(meaningful)) {
      const inner = meaningful
        .map((child) => serializeInline(child))
        .join("")
        .trim()
      this.writeLine(depth, `${open}${inner}</${tagName}>`)
      return
    }

    this.writeLine(depth, open)
    for (const child of meaningful) {
      if (isElement(child)) {
        this.emitElement(child, depth + 1)
        continue
      }
      if (isCommentNode(child)) {
        this.writeLine(depth + 1, `<!--${child.data}-->`)
        continue
      }
      if (isTextNode(child)) {
        const text = child.value.trim()
        if (text.length === 0) continue
        // Emit text on its own line. parse5 returns decoded values, so
        // we escape HTML-significant characters before emitting.
        this.writeLine(depth + 1, escapeText(text))
      }
    }
    this.writeLine(depth, `</${tagName}>`)
  }

  /**
   * Raw-text elements (<pre>, <textarea>, <script>, <style>) keep their
   * inner content verbatim. We emit the open tag at `depth`, the content
   * with no added indentation, and the close tag at `depth` only if the
   * content ends with a newline; otherwise we keep the close tag on the
   * same line. This matches how humans typically author these blocks and
   * round-trips through `normalizeHtml(normalizeHtml(x))` cleanly.
   *
   * For `<style>` elements, the CSS is beautified before emission so
   * stored HTML always has readable multi-line CSS — even when the model
   * emits minified output.
   */
  private emitRawTextElement(element: Element, depth: number, openTag: string): void {
    const tagName = element.tagName.toLowerCase()
    const children = defaultTreeAdapter.getChildNodes(element) as ChildNode[]

    let raw = ""
    for (const child of children) {
      if (isTextNode(child)) {
        raw += child.value
        continue
      }
      // parse5 puts <script>/<style> bodies into a single text node, so
      // any element children here are exotic. Serialize them raw.
      if (isElement(child)) {
        raw += serializeRaw(child)
        continue
      }
      if (isCommentNode(child)) {
        raw += `<!--${child.data}-->`
      }
    }

    // Beautify CSS in <style> tags for readability.
    if (tagName === "style" && raw.trim()) {
      raw = beautifyCss(raw)
    }

    const closeTag = `</${tagName}>`

    if (raw.length === 0) {
      this.writeLine(depth, `${openTag}${closeTag}`)
      return
    }

    // Single-line content — keep it on one line for a tight render.
    if (!raw.includes("\n")) {
      this.writeLine(depth, `${openTag}${raw}${closeTag}`)
      return
    }

    // Multi-line content — write the open tag, then the raw body
    // unindented, then the close tag at the parent depth on its own line
    // if the body ended with a newline; otherwise on the same line as the
    // last content character.
    this.writeIndent(depth)
    this.out += openTag
    this.out += raw
    if (!raw.endsWith("\n")) this.out += "\n"
    this.writeLine(depth, closeTag)
  }

  private writeLine(depth: number, content: string): void {
    this.writeIndent(depth)
    this.out += content
    this.out += "\n"
  }

  private writeIndent(depth: number): void {
    for (let i = 0; i < depth; i += 1) this.out += this.indent
  }
}

// ---------------------------------------------------------------------------
// Tree-adapter helpers (typed wrappers around parse5's default adapter)
// ---------------------------------------------------------------------------

function isElement(node: ChildNode | ParentNode): node is Element {
  return defaultTreeAdapter.isElementNode(node as Element)
}

function isTextNode(node: ChildNode): node is TextNode {
  return defaultTreeAdapter.isTextNode(node as TextNode)
}

function isCommentNode(node: ChildNode): node is CommentNode {
  return defaultTreeAdapter.isCommentNode(node as CommentNode)
}

function isDocumentType(node: ChildNode): node is DocumentType {
  return defaultTreeAdapter.isDocumentTypeNode(node as DocumentType)
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function serializeDoctype(node: DocumentType): string {
  // parse5 normalizes the DOCTYPE name to lowercase. The HTML5 living
  // standard requires `<!DOCTYPE html>` exactly in lowercase except for
  // the `DOCTYPE` keyword, which is conventionally uppercase.
  const name = node.name || "html"
  if (!node.publicId && !node.systemId) {
    return `<!DOCTYPE ${name}>`
  }
  // Legacy doctypes — preserve the public/system identifiers verbatim.
  let out = `<!DOCTYPE ${name}`
  if (node.publicId) out += ` PUBLIC "${node.publicId}"`
  if (node.systemId) out += ` "${node.systemId}"`
  out += ">"
  return out
}

function serializeOpenTag(element: Element): string {
  const tag = element.tagName.toLowerCase()
  const attrs = defaultTreeAdapter.getAttrList(element)
  if (attrs.length === 0) return `<${tag}>`

  const parts: string[] = [tag]
  for (const attr of attrs) {
    const name = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name
    if (attr.value === "") {
      // Boolean attributes are emitted as bare names. This matches modern
      // HTML5 conventions (e.g. `<input disabled>`) and keeps the output
      // shorter, but we only do it when parse5 reports an empty string —
      // which is also what it produces for `<input disabled>` input.
      parts.push(name)
      continue
    }
    parts.push(`${name}="${escapeAttribute(attr.value)}"`)
  }
  return `<${parts.join(" ")}>`
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/\u00a0/g, "&nbsp;")
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\u00a0/g, "&nbsp;")
}

/**
 * Serialize an element and its descendants to a raw HTML string with no
 * pretty-printing. Used inside raw-text elements where exotic children
 * occasionally appear.
 */
function serializeRaw(node: ChildNode): string {
  if (isTextNode(node)) return node.value
  if (isCommentNode(node)) return `<!--${node.data}-->`
  if (!isElement(node)) return ""
  const tag = node.tagName.toLowerCase()
  const open = serializeOpenTag(node)
  if (VOID_ELEMENTS.has(tag)) return open
  const children = defaultTreeAdapter.getChildNodes(node) as ChildNode[]
  let inner = ""
  for (const child of children) inner += serializeRaw(child)
  return `${open}${inner}</${tag}>`
}

// ---------------------------------------------------------------------------
// Inline emission rules
// ---------------------------------------------------------------------------

/**
 * Drop whitespace-only text nodes that sit between block elements; they
 * came from pretty-printed source and have no semantic value at the
 * document level.
 */
function filterMeaningfulChildren(children: ChildNode[]): ChildNode[] {
  return children.filter((child) => {
    if (!isTextNode(child)) return true
    return child.value.trim().length > 0
  })
}

/**
 * An element can be emitted on a single line if all of its meaningful
 * children are text or inline elements. This keeps short snippets like
 * `<h1>Hello <span>world</span></h1>` compact and round-trip safe.
 */
function canEmitInline(children: ChildNode[]): boolean {
  if (children.length === 0) return true
  for (const child of children) {
    if (isTextNode(child)) continue
    if (isCommentNode(child)) return false
    if (!isElement(child)) return false
    const tag = child.tagName.toLowerCase()
    if (!INLINE_ELEMENTS.has(tag)) return false
    if (RAW_TEXT_ELEMENTS.has(tag)) return false
    // An inline element with multi-line text content forces block layout.
    const grand = defaultTreeAdapter.getChildNodes(child) as ChildNode[]
    for (const g of grand) {
      if (isTextNode(g) && g.value.includes("\n")) return false
    }
    if (!canEmitInline(filterMeaningfulChildren(grand))) return false
  }
  // Any text node that contains a newline is also a hard "no".
  for (const child of children) {
    if (isTextNode(child) && child.value.includes("\n")) return false
  }
  return true
}

function serializeInline(node: ChildNode): string {
  if (isTextNode(node)) {
    // Collapse only runs of whitespace that span newlines/tabs from
    // pretty-printed source. Single spaces stay intact.
    const collapsed = node.value.replace(/[\t\n\r]+\s*/g, " ")
    return escapeText(collapsed)
  }
  if (isCommentNode(node)) return `<!--${node.data}-->`
  if (!isElement(node)) return ""
  const tag = node.tagName.toLowerCase()
  const open = serializeOpenTag(node)
  if (VOID_ELEMENTS.has(tag)) return open
  const children = defaultTreeAdapter.getChildNodes(node) as ChildNode[]
  const inner = children.map((c) => serializeInline(c)).join("")
  return `${open}${inner}</${tag}>`
}

// ---------------------------------------------------------------------------
// Deterministic CSS beautifier
// ---------------------------------------------------------------------------

/**
 * Beautify a CSS string into readable multi-line form with consistent
 * indentation. Must be idempotent: `beautifyCss(beautifyCss(x)) === beautifyCss(x)`.
 *
 * Rules:
 *  - One selector per line (handles comma-separated selectors by joining them).
 *  - Opening brace on the same line as the selector.
 *  - Each declaration on its own line, indented 2 spaces.
 *  - Closing brace on its own line at selector depth.
 *  - `@media`/`@keyframes`/`@supports` blocks increase indent for their contents.
 *  - `@keyframes` percentage selectors stay at the @keyframes indent level.
 *  - Comments preserved on their own line.
 *  - Whitespace inside declarations collapsed to single spaces.
 */
function beautifyCss(css: string): string {
  if (!css) return css

  const IND = "  "
  const lines: string[] = []
  let depth = 0
  let pos = 0

  const peek = (offset = 0): string => css[pos + offset] ?? ""
  const consume = (n = 1): string => { const r = css.slice(pos, pos + n); pos += n; return r }
  const skipWhitespace = (): void => {
    while (pos < css.length && /[\t\n\r ]/.test(css[pos])) pos++
  }
  const skipToNewline = (): void => {
    while (pos < css.length && css[pos] !== "\n") pos++
  }

  const pushLine = (d: number, text: string): void => {
    const trimmed = text.trimEnd()
    if (trimmed) lines.push(IND.repeat(d) + trimmed)
  }

  // Strip leading/trailing whitespace from the whole input.
  css = css.trim()

  while (pos < css.length) {
    skipWhitespace()
    if (pos >= css.length) break

    const ch = css[pos]

    // Comment: /* ... */
    if (ch === "/" && peek(1) === "*") {
      const end = css.indexOf("*/", pos + 2)
      if (end === -1) { pos = css.length; break }
      pushLine(depth, css.slice(pos, end + 2))
      pos = end + 2
      continue
    }

    // @-rule: @media, @keyframes, @supports, @import, @font-face, @charset
    if (ch === "@") {
      const ruleEnd = css.indexOf("{", pos)
      const semiEnd = css.indexOf(";", pos)
      // @import / @charset end with ; not {
      if (semiEnd !== -1 && (ruleEnd === -1 || semiEnd < ruleEnd)) {
        pushLine(depth, css.slice(pos, semiEnd + 1))
        pos = semiEnd + 1
        continue
      }
      if (ruleEnd === -1) { pos = css.length; break }
      const header = css.slice(pos, ruleEnd + 1).trim()
      pos = ruleEnd + 1
      pushLine(depth, header)
      depth++
      continue
    }

    // Closing brace
    if (ch === "}") {
      consume()
      depth = Math.max(0, depth - 1)
      pushLine(depth, "}")
      continue
    }

    // Selector or declaration — read until {, }, or ;
    const braceEnd = css.indexOf("{", pos)
    const closingBrace = css.indexOf("}", pos)
    const semiEnd = css.indexOf(";", pos)
    const nextStop = Math.min(
      braceEnd === -1 ? Infinity : braceEnd,
      closingBrace === -1 ? Infinity : closingBrace,
      semiEnd === -1 ? Infinity : semiEnd,
    )

    if (nextStop === Infinity) { pos = css.length; break }

    // If the next stop is {, this is a selector block (or @keyframes percentage).
    if (nextStop === braceEnd) {
      let selector = css.slice(pos, braceEnd).trim()
      pos = braceEnd + 1
      // Comma-separated selectors stay on one line.
      pushLine(depth, selector + " {")
      depth++
      continue
    }

    // If the next stop is ;, this is a declaration.
    if (nextStop === semiEnd) {
      const decl = css.slice(pos, semiEnd + 1).replace(/\s+/g, " ").trim()
      pos = semiEnd + 1
      // @keyframes percentage stops (from {, to {, 50% {) are not declarations.
      if (/^(?:from|to|\d+(?:\.\d+)?%)\s*\{?\s*$/.test(decl)) {
        depth = Math.max(0, depth - 1)
        pushLine(depth, decl.replace(/\{?\s*$/, "").trim() + " {")
        depth++
        continue
      }
      pushLine(depth, decl)
      continue
    }

    // Closing brace encountered before { or ; — emit it.
    if (nextStop === closingBrace) {
      consume(closingBrace - pos + 1)
      depth = Math.max(0, depth - 1)
      pushLine(depth, "}")
      continue
    }
  }

  return lines.join("\n") + "\n"
}
