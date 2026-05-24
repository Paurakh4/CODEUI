#!/usr/bin/env node
// Standalone Gmail SMTP test. Reads .env.local, verifies credentials, and
// sends a test email if --to=<address> is provided.
//
//   node scripts/test-gmail.mjs            # verify only
//   node scripts/test-gmail.mjs --to=you@example.com  # also send a test email

import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

function loadDotenv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotenv(path.resolve(process.cwd(), ".env.local"));

const user = process.env.GMAIL_USER;
const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
const from = process.env.GMAIL_FROM || (user ? `CodeUI <${user}>` : null);

if (!user || !pass) {
  console.error("Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env.local");
  process.exit(1);
}

console.log(`GMAIL_USER:         ${user}`);
console.log(`GMAIL_APP_PASSWORD: ${"*".repeat(pass.length)} (${pass.length} chars)`);
console.log(`GMAIL_FROM:         ${from}`);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user, pass },
});

try {
  console.log("\nVerifying SMTP connection ...");
  await transporter.verify();
  console.log("OK: Gmail accepted the credentials.");
} catch (err) {
  console.error("FAIL: Gmail rejected the credentials.");
  console.error(err);
  process.exit(2);
}

const toArg = process.argv.find((a) => a.startsWith("--to="));
if (toArg) {
  const to = toArg.slice("--to=".length);
  console.log(`\nSending test email to ${to} ...`);
  const info = await transporter.sendMail({
    from,
    to,
    subject: "CodeUI: Gmail SMTP test",
    text: "This is a test email from scripts/test-gmail.mjs. If you got this, password reset will work.",
    html: "<p>This is a test email from <code>scripts/test-gmail.mjs</code>. If you got this, password reset will work.</p>",
  });
  console.log("Sent. messageId:", info.messageId);
  console.log("response:", info.response);
}
