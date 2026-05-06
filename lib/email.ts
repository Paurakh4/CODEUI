import "server-only"

import nodemailer from "nodemailer"

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
}

let cachedTransporter: nodemailer.Transporter | null = null

function isEmailDebugEnabled(): boolean {
  return process.env.NODE_ENV !== "production"
}

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.SMTP_FROM,
  )
}

function getSmtpTransporter(): nodemailer.Transporter | null {
  if (!isSmtpConfigured()) {
    return null
  }

  if (cachedTransporter) {
    return cachedTransporter
  }

  const port = Number(process.env.SMTP_PORT || "587")

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })

  return cachedTransporter
}

export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
): Promise<TransactionalEmailDeliveryResult> {
  const transporter = getSmtpTransporter()

  if (!transporter) {
    if (isEmailDebugEnabled()) {
      console.info(`[${input.logLabel}] ${input.to} -> ${input.subject}`)
    } else {
      console.warn(
        `[${input.logLabel}] SMTP is not configured; email delivery skipped for ${input.to}`,
      )
    }

    return {
      delivered: false,
      skipped: true,
      skipReason: "smtp-not-configured",
    }
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })

  return {
    delivered: true,
    skipped: false,
  }
}