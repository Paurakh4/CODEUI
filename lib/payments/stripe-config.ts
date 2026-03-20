const PLACEHOLDER_TOKENS = ["...", "your-", "price_xxx"]

function getEnvValue(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function isPlaceholderValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return PLACEHOLDER_TOKENS.some((token) => normalized.includes(token))
}

export function getRequiredEnvIssue(name: string): string | null {
  const value = getEnvValue(name)

  if (!value) {
    return `${name} is missing`
  }

  if (isPlaceholderValue(value)) {
    return `${name} is still set to a placeholder value`
  }

  return null
}

export function getStripeServerConfigIssues(): string[] {
  return [getRequiredEnvIssue("STRIPE_SECRET_KEY")].filter(
    (issue): issue is string => Boolean(issue)
  )
}

export function getStripeWebhookConfigIssues(): string[] {
  return [
    ...getStripeServerConfigIssues(),
    getRequiredEnvIssue("STRIPE_WEBHOOK_SECRET"),
  ].filter((issue): issue is string => Boolean(issue))
}

export function buildAppUrl(pathnameWithQuery: string): string {
  const appUrl = getEnvValue("NEXT_PUBLIC_APP_URL")

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is missing")
  }

  if (isPlaceholderValue(appUrl)) {
    throw new Error("NEXT_PUBLIC_APP_URL is still set to a placeholder value")
  }

  try {
    return new URL(pathnameWithQuery, appUrl)
      .toString()
      .replace(/%7BCHECKOUT_SESSION_ID%7D/g, "{CHECKOUT_SESSION_ID}")
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL is not a valid URL")
  }
}

export function isConfiguredEnvValue(value: string | undefined): value is string {
  return Boolean(value && !isPlaceholderValue(value))
}