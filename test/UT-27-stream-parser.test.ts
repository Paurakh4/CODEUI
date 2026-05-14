import { describe, expect, it } from "vitest"

import { validateAIResponse } from "@/lib/parsers/stream-parser"

describe("UT-27 validateAIResponse", () => {
  it("rejects React-style event handlers inside HTML documents", () => {
    const response = `<!DOCTYPE html>
<html>
  <body>
    <button onClick="appendDigit('7')">7</button>
    <script>
      function appendDigit(value) {
        console.log(value)
      }
    </script>
  </body>
</html>`

    expect(validateAIResponse(response)).toEqual({
      valid: false,
      reason: "AI response used framework-style camelCase event handlers instead of browser-ready JavaScript.",
    })
  })

  it("accepts browser-ready inline JavaScript in HTML documents", () => {
    const response = `<!DOCTYPE html>
<html>
  <body>
    <button onclick="appendDigit('7')">7</button>
    <script>
      function appendDigit(value) {
        console.log(value)
      }
    </script>
  </body>
</html>`

    expect(validateAIResponse(response)).toEqual({ valid: true })
  })
})