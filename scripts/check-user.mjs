#!/usr/bin/env node
// Inspect a user record to see whether they can do a password reset.
//   node scripts/check-user.mjs you@example.com

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

function loadDotenv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotenv(path.resolve(process.cwd(), ".env.local"));

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/check-user.mjs <email>");
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

await mongoose.connect(uri);
const users = mongoose.connection.collection("users");
const user = await users.findOne({ email });

if (!user) {
  console.log(`No user found for ${email}`);
} else {
  console.log({
    _id: user._id?.toString(),
    email: user.email,
    googleId: user.googleId,
    hasPasswordHash: Boolean(user.passwordHash),
    accountStatus: user.accountStatus,
    canResetPassword: Boolean(
      user.passwordHash || (typeof user.googleId === "string" && user.googleId.startsWith("local:")),
    ),
  });
}

await mongoose.disconnect();
