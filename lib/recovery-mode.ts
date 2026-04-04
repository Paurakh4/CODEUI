export type RecoveryMode = "patch-repair" | "full-document"
export type RecoveryModeValue = RecoveryMode | boolean | undefined

export function resolveRecoveryMode(isFollowUp: boolean): RecoveryMode {
  return isFollowUp ? "patch-repair" : "full-document"
}

export function isRecoveryModeActive(recoveryMode: RecoveryModeValue): boolean {
  return recoveryMode !== undefined && recoveryMode !== false
}

export function isFullDocumentRecoveryMode(recoveryMode: RecoveryModeValue): boolean {
  return recoveryMode === true || recoveryMode === "full-document"
}

export function isPatchRepairRecoveryMode(recoveryMode: RecoveryModeValue): boolean {
  return recoveryMode === "patch-repair"
}