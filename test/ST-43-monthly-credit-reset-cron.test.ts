import fs from "node:fs"
import path from "node:path"
import mongoose from "mongoose"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { getMonthlyCreditsForTier } from "@/lib/pricing"

function loadLocalEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local")

  if (!fs.existsSync(envPath)) {
    return
  }

  const envContents = fs.readFileSync(envPath, "utf8")

  for (const line of envContents.split(/\r?\n/)) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmedLine.indexOf("=")

    if (separatorIndex === -1) {
      continue
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1)

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadLocalEnvFile()

const ELIGIBLE_EMAIL = "st43-eligible@example.com"
const INELIGIBLE_EMAIL = "st43-ineligible@example.com"

let connectDB: typeof import("@/lib/db").default
let User: typeof import("@/lib/models").User
let POST: typeof import("@/app/api/cron/reset-credits/route").POST

async function cleanupTestUsers() {
  if (!User) {
    return
  }

  await User.deleteMany({
    email: { $in: [ELIGIBLE_EMAIL, INELIGIBLE_EMAIL] },
  })
}

describe("ST-43 monthly credit reset cron", () => {
  beforeAll(async () => {
    ;({ default: connectDB } = await import("@/lib/db"))
    ;({ User } = await import("@/lib/models"))
    ;({ POST } = await import("@/app/api/cron/reset-credits/route"))

    await connectDB()
  })

  afterEach(async () => {
    await cleanupTestUsers()
  })

  afterAll(async () => {
    await cleanupTestUsers()
    await mongoose.disconnect()
  })

  it("refreshes only eligible user balances when called with a valid secret", async () => {
    process.env.CRON_SECRET = "st-43-valid-secret"

    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const expectedNextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    await cleanupTestUsers()

    await User.create([
      {
        email: ELIGIBLE_EMAIL,
        googleId: "st43-google-eligible",
        name: "ST-43 Eligible",
        subscription: { tier: "pro" },
        monthlyCredits: 5,
        topupCredits: 17,
        creditsResetDate: yesterday,
        credits: 22,
        creditsUsedThisMonth: 8,
      },
      {
        email: INELIGIBLE_EMAIL,
        googleId: "st43-google-ineligible",
        name: "ST-43 Ineligible",
        subscription: { tier: "proplus" },
        monthlyCredits: 77,
        topupCredits: 9,
        creditsResetDate: tomorrow,
        credits: 86,
        creditsUsedThisMonth: 3,
      },
    ])

    const response = await POST(
      new Request("http://localhost:3000/api/cron/reset-credits", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }),
    )

    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.success).toBe(true)
    expect(payload.usersReset).toBeGreaterThanOrEqual(1)
    expect(payload.errors).toBe(0)

    const eligible = await User.findOne({ email: ELIGIBLE_EMAIL }).lean()
    const ineligible = await User.findOne({ email: INELIGIBLE_EMAIL }).lean()

    expect(eligible).toBeTruthy()
    expect(ineligible).toBeTruthy()

    expect(eligible?.monthlyCredits).toBe(getMonthlyCreditsForTier("pro"))
    expect(eligible?.credits).toBe(getMonthlyCreditsForTier("pro"))
    expect(eligible?.topupCredits).toBe(17)
    expect(eligible?.creditsUsedThisMonth).toBe(0)
    expect(eligible?.creditsResetDate?.toISOString()).toBe(expectedNextResetDate.toISOString())

    expect(ineligible?.monthlyCredits).toBe(77)
    expect(ineligible?.credits).toBe(86)
    expect(ineligible?.topupCredits).toBe(9)
    expect(ineligible?.creditsUsedThisMonth).toBe(3)
    expect(ineligible?.creditsResetDate?.toISOString()).toBe(tomorrow.toISOString())
  })
})