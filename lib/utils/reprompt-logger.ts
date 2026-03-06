type RepromptLogLevel = "debug" | "info" | "warn" | "error"

export interface RepromptLogMetadata {
  phase?: string
  requestId?: number | string
  [key: string]: unknown
}

const isDebugLoggingEnabled = () => {
  const debugFlag =
    process.env.DEBUG_REPROMPTING ?? process.env.NEXT_PUBLIC_DEBUG_REPROMPTING ?? ""

  return debugFlag === "1" || debugFlag.toLowerCase() === "true"
}

const writeLog = (
  scope: string,
  level: RepromptLogLevel,
  message: string,
  metadata: RepromptLogMetadata,
) => {
  if (level === "debug" && !isDebugLoggingEnabled()) {
    return
  }

  const entry = {
    ts: new Date().toISOString(),
    scope,
    level,
    message,
    ...metadata,
  }

  const writer =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "info"
          ? console.info
          : console.debug

  writer("[reprompt]", entry)
}

export const createRepromptLogger = (scope: string, defaults: RepromptLogMetadata = {}) => ({
  debug: (message: string, metadata: RepromptLogMetadata = {}) => {
    writeLog(scope, "debug", message, { ...defaults, ...metadata })
  },
  info: (message: string, metadata: RepromptLogMetadata = {}) => {
    writeLog(scope, "info", message, { ...defaults, ...metadata })
  },
  warn: (message: string, metadata: RepromptLogMetadata = {}) => {
    writeLog(scope, "warn", message, { ...defaults, ...metadata })
  },
  error: (message: string, metadata: RepromptLogMetadata = {}) => {
    writeLog(scope, "error", message, { ...defaults, ...metadata })
  },
})