import "server-only"

import nodemailer, { type Transporter } from "nodemailer"

export interface TransactionalEmailInput {
  logLabel: string
  to: string
  subject: string
  text: string
  html: string
}

export interface TransactionalEmailDeliveryResult {
  delivered: boolean
  skipped: boolean
  skipReason?: "smtp-not-configured"
  error?: string
}

type EmailProvider = "gmail" | "smtp" | "none"

let cachedTransporter: Transporter | null = null
let cachedFrom: string | null = null

function isEmailDebugEnabled(): boolean {
  return process.env.NODE_ENV !== "production"
}

function isGmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.SMTP_FROM,
  )
}

function getEmailProvider(): EmailProvider {
  if (isGmailConfigured()) return "gmail"
  if (isSmtpConfigured()) return "smtp"
  return "none"
}

function buildGmailTransport(): { transporter: Transporter; from: string } {
  const user = process.env.GMAIL_USER!
  // Gmail App Passwords are typically displayed with spaces; strip them so the
  // user can paste the value as-is from Google's UI.
  const pass = process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, "")

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  })

  const from = process.env.GMAIL_FROM || `CodeUI <${user}>`

  return { transporter, from }
}

function buildSmtpTransport(): { transporter: Transporter; from: string } {
  const port = Number(process.env.SMTP_PORT || "587")

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASSWORD!,
    },
  })

  return { transporter, from: process.env.SMTP_FROM! }
}

function getMailer(): { transporter: Transporter; from: string } | null {
  if (cachedTransporter && cachedFrom) {
    return { transporter: cachedTransporter, from: cachedFrom }
  }

  const provider = getEmailProvider()

  if (provider === "gmail") {
    const built = buildGmailTransport()
    cachedTransporter = built.transporter
    cachedFrom = built.from
    return built
  }

  if (provider === "smtp") {
    const built = buildSmtpTransport()
    cachedTransporter = built.transporter
    cachedFrom = built.from
    return built
  }

  return null
}

export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
): Promise<TransactionalEmailDeliveryResult> {
  const mailer = getMailer()

  if (!mailer) {
    if (isEmailDebugEnabled()) {
      console.info(
        `[${input.logLabel}] No mail transport configured. Would send to ${input.to} -> ${input.subject}`,
      )
    } else {
      console.warn(
        `[${input.logLabel}] No mail transport configured; email delivery skipped for ${input.to}`,
      )
    }

    return {
      delivered: false,
      skipped: true,
      skipReason: "smtp-not-configured",
    }
  }

  try {
    await mailer.transporter.sendMail({
      from: mailer.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })

    if (isEmailDebugEnabled()) {
      console.info(`[${input.logLabel}] sent to ${input.to}`)
    }

    return { delivered: true, skipped: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[${input.logLabel}] failed to send email to ${input.to}:`, error)
    return {
      delivered: false,
      skipped: false,
      error: message,
    }
  }
}
