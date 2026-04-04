import { describe, expect, it } from "vitest"

import { buildContext } from "@/lib/context-builder"

describe("buildContext", () => {
  it("adds focused target guidance when a selected element is provided", () => {
    const currentFile = `<!DOCTYPE html>
<html>
  <body>
    <section class="pricing-shell">
      <h1>Pricing</h1>
      <div class="card card-pro">
        <h2>Pro</h2>
        <p>$49/mo</p>
        <button class="primary-cta">Start Pro</button>
      </div>
    </section>
  </body>
</html>`
    const selectedElement = `<button class="primary-cta">Start Pro</button>`

    const context = buildContext({
      currentFile: { name: "index.html", content: currentFile },
      selectedElement,
      maxTokens: 4000,
    })

    expect(context).toContain("Target element to modify first:")
    expect(context).toContain("Local surrounding context for the target element:")
    expect(context).toContain("Reference file: index.html")
    expect(context).toContain("Preserve the current page and change only the requested area.")
    expect(context).toContain("<section class=\"pricing-shell\">")
  })

  it("keeps the standard current-file label when no selected element is provided", () => {
    const context = buildContext({
      currentFile: {
        name: "index.html",
        content: "<!DOCTYPE html><html><body><main>Standalone page</main></body></html>",
      },
      maxTokens: 4000,
    })

    expect(context).toContain("Current file: index.html")
    expect(context).not.toContain("Reference file: index.html")
    expect(context).not.toContain("Target element to modify first:")
  })
})