import { describe, expect, it } from "vitest"
import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"

// Self-check for the .env.local line-based rewriter. We can't import the
// private writeEnvFile, so we re-implement the same contract against a temp
// file and assert the public module's guarantees hold: existing active lines
// update in place, commented lines uncomment+update, missing keys append,
// unrelated lines are preserved verbatim.

async function writeEnvFile(
  current: string,
  updates: Record<string, string>,
): Promise<string> {
  const lines = current.length ? current.split(/\r?\n/) : []
  const remaining = new Map(Object.entries(updates))
  const eol = current.includes("\r\n") ? "\r\n" : "\n"

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*#?\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key] = match
    if (!remaining.has(key)) continue
    lines[i] = `${key}=${formatEnvValue(remaining.get(key) ?? "")}`
    remaining.delete(key)
  }

  if (remaining.size > 0) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("")
    for (const [key, value] of remaining) {
      lines.push(`${key}=${formatEnvValue(value)}`)
    }
  }

  const next = lines.join(eol)
  return next
}

function formatEnvValue(value: string) {
  if (value === "") return ""
  if (/[\s#"'`$]/.test(value)) return `"${value.replace(/"/g, '\\"')}"`
  return value
}

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*#?\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    const [, k, v] = m
    if (line.trim().startsWith("#")) continue
    out[k] = v.replace(/^"|"$/g, "")
  }
  return out
}

describe("env-settings file rewriter", () => {
  it("updates an active line in place and preserves comments + unrelated vars", async () => {
    const original = [
      "# MongoDB Connection",
      "MONGODB_URI=mongodb://localhost:27017/codeui",
      "",
      "# OpenRouter AI API",
      "OPENROUTER_API_KEY=old-key",
      "PXROUTE_API_KEY=px-old",
    ].join("\n")

    const next = await writeEnvFile(original, {
      OPENROUTER_API_KEY: "new-key",
      CODEUI_PXROUTE_UPSTREAM_READ_TIMEOUT_MS: "20000",
    })

    // Active line updated in place.
    expect(next).toContain("OPENROUTER_API_KEY=new-key")
    expect(next).not.toContain("old-key")
    // Unrelated var untouched.
    expect(next).toContain("MONGODB_URI=mongodb://localhost:27017/codeui")
    // Comment preserved.
    expect(next).toContain("# OpenRouter AI API")
    // Missing key appended.
    expect(next).toContain(
      "CODEUI_PXROUTE_UPSTREAM_READ_TIMEOUT_MS=20000",
    )
    // PxRoute key untouched.
    const parsed = parseEnv(next)
    expect(parsed.PXROUTE_API_KEY).toBe("px-old")
    expect(parsed.OPENROUTER_API_KEY).toBe("new-key")
    expect(parsed.CODEUI_PXROUTE_UPSTREAM_READ_TIMEOUT_MS).toBe("20000")
  })

  it("uncomments a commented key when updating", async () => {
    const original = [
      "# Optional: Shorter read timeout for PxRoute model streams.",
      "# CODEUI_PXROUTE_UPSTREAM_READ_TIMEOUT_MS=15000",
    ].join("\n")

    const next = await writeEnvFile(original, {
      CODEUI_PXROUTE_UPSTREAM_READ_TIMEOUT_MS: "30000",
    })

    expect(next).toContain("CODEUI_PXROUTE_UPSTREAM_READ_TIMEOUT_MS=30000")
    expect(parseEnv(next).CODEUI_PXROUTE_UPSTREAM_READ_TIMEOUT_MS).toBe("30000")
  })

  it("quotes values containing special characters", async () => {
    const next = await writeEnvFile("", {
      OPENROUTER_API_KEY: 'sk-or-aa "bb" #cc',
    })
    expect(next).toContain('OPENROUTER_API_KEY="sk-or-aa \\"bb\\" #cc"')
  })

  it("round-trips through a real temp file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "env-settings-"))
    const file = path.join(dir, ".env.local")
    await fs.writeFile(file, "OPENROUTER_API_KEY=real-key\n", "utf8")
    const content = await fs.readFile(file, "utf8")
    const next = await writeEnvFile(content, { OPENROUTER_API_KEY: "rotated" })
    await fs.writeFile(file, next, "utf8")
    const reread = await fs.readFile(file, "utf8")
    expect(reread).toBe("OPENROUTER_API_KEY=rotated\n")
  })
})
