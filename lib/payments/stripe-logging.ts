type StripeLogLevel = "info" | "warn" | "error"

function getLogMethod(level: StripeLogLevel) {
  switch (level) {
    case "warn":
      return console.warn
    case "error":
      return console.error
    default:
      return console.info
  }
}

export function serializeStripeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
  }
}

export function logStripeFlow(
  level: StripeLogLevel,
  event: string,
  context: Record<string, unknown> = {}
) {
  const log = getLogMethod(level)
  log(`[STRIPE_FLOW] ${event}`, {
    timestamp: new Date().toISOString(),
    ...context,
  })
}