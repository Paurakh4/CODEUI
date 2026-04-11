import { describe, expect, it } from "vitest"

import {
  FULL_DOCUMENT_RECOVERY_FAILURE_MESSAGE,
  GENERIC_TARGETED_UPDATE_FAILURE_MESSAGE,
  describeTargetedUpdateFailure,
  isCompleteHtmlDocument,
  selectStableHtmlDocument,
} from "@/lib/ai-update-recovery"

describe("ai update recovery helpers", () => {
  it("detects complete html documents", () => {
    expect(isCompleteHtmlDocument("<!DOCTYPE html><html><body>Hello</body></html>")).toBe(true)
    expect(isCompleteHtmlDocument("<html><body>Hello</body></html>")).toBe(true)
    expect(isCompleteHtmlDocument("<html><body>Hello</body>")).toBe(false)
    expect(isCompleteHtmlDocument("")).toBe(false)
  })

  it("selects the first stable html document candidate", () => {
    expect(
      selectStableHtmlDocument(
        [
          "<html><body>broken",
          "\n<!DOCTYPE html><html><body>stable</body></html>\n",
          "<!DOCTYPE html><html><body>later</body></html>",
        ],
        "<!DOCTYPE html><html><body>fallback</body></html>",
      ),
    ).toBe("<!DOCTYPE html><html><body>stable</body></html>")
  })

  it("falls back when no stable html document exists", () => {
    expect(
      selectStableHtmlDocument(
        ["plain text", "<div>fragment</div>"],
        "<!DOCTYPE html><html><body>fallback</body></html>",
      ),
    ).toBe("<!DOCTYPE html><html><body>fallback</body></html>")
  })

  it("describes unsupported patch targets explicitly", () => {
    expect(
      describeTargetedUpdateFailure({
        kind: "unsupported-target",
        filePath: "components/ui/toaster.tsx",
      }),
    ).toContain("components/ui/toaster.tsx")
  })

  it("returns stable generic failure messages", () => {
    expect(describeTargetedUpdateFailure()).toBe(GENERIC_TARGETED_UPDATE_FAILURE_MESSAGE)
    expect(FULL_DOCUMENT_RECOVERY_FAILURE_MESSAGE).toContain("smaller, more specific")
  })
})
