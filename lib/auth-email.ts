import "server-only";

import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import connectDB from "@/lib/db";
import { normalizeAuthEmail } from "@/lib/local-auth";
import AuthToken, { type AuthTokenType } from "@/lib/models/AuthToken";
import {
  AUTH_TOKEN_TTL_MS,
  buildAuthActionUrl,
  hashAuthActionToken,
} from "@/lib/auth-token-utils";

type AuthEmailPurpose = AuthTokenType;

interface AuthEmailDeliveryResult {
  delivered: boolean;
  debugUrl?: string;
}

let cachedTransporter: nodemailer.Transporter | null = null;

function isLocalAuthDebugEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.SMTP_FROM
  );
}

function getSmtpTransporter(): nodemailer.Transporter | null {
  if (!isSmtpConfigured()) {
    return null;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  const port = Number(process.env.SMTP_PORT || "587");

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return cachedTransporter;
}

function getAuthEmailCopy(type: AuthEmailPurpose, actionUrl: string) {
  if (type === "password-reset") {
    return {
      subject: "Reset your CodeUI password",
      text: `Reset your CodeUI password by visiting ${actionUrl}. This link expires in 1 hour.`,
      html: `<p>Reset your CodeUI password by opening the link below. This link expires in 1 hour.</p><p><a href="${actionUrl}">${actionUrl}</a></p>`,
    };
  }

  return {
    subject: "Verify your CodeUI email",
    text: `Verify your CodeUI email by visiting ${actionUrl}. This link expires in 24 hours.`,
    html: `<p>Verify your CodeUI email by opening the link below. This link expires in 24 hours.</p><p><a href="${actionUrl}">${actionUrl}</a></p>`,
  };
}

export async function createAuthActionLink(input: {
  email: string;
  type: AuthEmailPurpose;
}) {
  await connectDB();

  const email = normalizeAuthEmail(input.email);
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashAuthActionToken(token);
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_TTL_MS[input.type]);

  await AuthToken.deleteMany({
    email,
    type: input.type,
    consumedAt: { $exists: false },
  });

  await AuthToken.create({
    email,
    type: input.type,
    tokenHash,
    expiresAt,
  });

  return {
    email,
    token,
    expiresAt,
    url: buildAuthActionUrl(input.type, token),
  };
}

export async function consumeAuthActionToken(input: {
  token: string;
  type: AuthEmailPurpose;
}) {
  await connectDB();

  const tokenHash = hashAuthActionToken(input.token);
  const record = await AuthToken.findOne({
    tokenHash,
    type: input.type,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    return null;
  }

  record.consumedAt = new Date();
  await record.save();

  await AuthToken.deleteMany({
    email: record.email,
    type: input.type,
    _id: { $ne: record._id },
  });

  return record;
}

export async function sendAuthActionEmail(input: {
  email: string;
  type: AuthEmailPurpose;
  actionUrl: string;
}): Promise<AuthEmailDeliveryResult> {
  const transporter = getSmtpTransporter();

  if (!transporter) {
    if (isLocalAuthDebugEnabled()) {
      console.info(
        `[AUTH_EMAIL:${input.type}] ${input.email} -> ${input.actionUrl}`
      );
    } else {
      console.warn(
        `[AUTH_EMAIL:${input.type}] SMTP is not configured; email delivery skipped for ${input.email}`
      );
    }

    return {
      delivered: false,
      debugUrl: isLocalAuthDebugEnabled() ? input.actionUrl : undefined,
    };
  }

  const copy = getAuthEmailCopy(input.type, input.actionUrl);

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: input.email,
    subject: copy.subject,
    text: copy.text,
    html: copy.html,
  });

  return { delivered: true };
}

export async function issueVerificationEmail(email: string) {
  const link = await createAuthActionLink({
    email,
    type: "email-verification",
  });

  const delivery = await sendAuthActionEmail({
    email: link.email,
    type: "email-verification",
    actionUrl: link.url,
  });

  return {
    ...link,
    ...delivery,
  };
}

export async function issuePasswordResetEmail(email: string) {
  const link = await createAuthActionLink({
    email,
    type: "password-reset",
  });

  const delivery = await sendAuthActionEmail({
    email: link.email,
    type: "password-reset",
    actionUrl: link.url,
  });

  return {
    ...link,
    ...delivery,
  };
}