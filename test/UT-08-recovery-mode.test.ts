import { describe, expect, it } from "vitest"

import {
  isFullDocumentRecoveryMode,
  isPatchRepairRecoveryMode,
  isRecoveryModeActive,
  resolveRecoveryMode,
} from "@/lib/recovery-mode"

describe("UT-08 recovery mode helpers", () => {
  it("uses patch repair for follow-up retries", () => {
    expect(resolveRecoveryMode(true)).toBe("patch-repair")
  })

  it("uses full-document recovery for initial generation retries", () => {
    expect(resolveRecoveryMode(false)).toBe("full-document")
  })

  it("distinguishes full-document and patch repair modes", () => {
    expect(isFullDocumentRecoveryMode("full-document")).toBe(true)
    expect(isFullDocumentRecoveryMode(true)).toBe(true)
    expect(isFullDocumentRecoveryMode("patch-repair")).toBe(false)
    expect(isPatchRepairRecoveryMode("patch-repair")).toBe(true)
    expect(isPatchRepairRecoveryMode("full-document")).toBe(false)
  })

  it("treats any retry mode as an active recovery attempt", () => {
    expect(isRecoveryModeActive("patch-repair")).toBe(true)
    expect(isRecoveryModeActive("full-document")).toBe(true)
    expect(isRecoveryModeActive(undefined)).toBe(false)
    expect(isRecoveryModeActive(false)).toBe(false)
  })
})