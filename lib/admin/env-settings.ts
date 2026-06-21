import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"
import { createAdminAuditEntry } from "@/lib/admin/audit"
import type { UserRole } from "@/lib/admin/rbac"

/**
 * Provider / model-fallback related env vars that are read at request time
 * (see lib/ai-provider-client.ts) and therefore safe to override at runtime.
 *
 * Model catalog / default / fallback / prompt-enhance model ids and custom
 * provider keys are already DB-backed (AdminModelConfig, AdminCustomProvider)
 * and editable from /admin/models — they are intentionally NOT listed here.
 */
export const ENV_SETTINGS_SCHEMA = [
  {
    key: "OPENROUTER_API_KEY",
    label: "OpenRouter API Key",
    type: "secret",
    group: "AI Providers",
    description: "Bearer key sent to openrouter.ai. Takes effect on the next completion request.",
  },
  {
    key: "PXROUTE_API_KEY",
    label: "PxRoute (MidRelay) API Key",
    type: "secret",
    group: "AI Providers",
    description: "Bearer key sent to api.midrelay.com. Takes effect on the next completion request.",
  },
  {
    key: "CODEUI_PXROUTE_UPSTREAM_READ_TIMEOUT_MS",
    label: "PxRoute read timeout (ms)",
    type: "number",
    group: "AI Timeouts",
    description: "Hard cap on a single PxRoute stream read. 1000–120000. Default 15000.",
    min: 1000,
    max: 120000,
  },
  {
    key: "CODEUI_UPSTREAM_READ_TIMEOUT_MS",
    label: "OpenRouter read timeout (ms)",
    type: "number",
    group: "AI Timeouts",
    description: "Hard cap on a single OpenRouter stream read. 5000–120000. Default 90000.",
    min: 5000,
    max: 120000,
  },
] as const

export type EnvSettingKey = (typeof ENV_SETTINGS_SCHEMA)[number]["key"]
export type EnvSettingType = "secret" | "number"

export interface EnvSettingDescriptor {
  key: EnvSettingKey
  label: string
  type: EnvSettingType
  group: string
  description: string
  min?: number
  max?: number
}

export interface EnvSettingView extends EnvSettingDescriptor {
  hasValue: boolean
  masked: string
}

interface AdminActor {
  id: string
  email?: string | null
  role: UserRole
}

function maskSecret(value: string) {
  if (!value) return ""
  if (value.length <= 8) return "••••"
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

function envFilePath() {
  return path.join(process.cwd(), ".env.local")
}

/**
 * Read .env.local as raw text. Returns "" when the file is absent so callers
 * can treat a missing file the same as an empty one (we create on first write).
 */
async function readEnvFile(): Promise<string> {
  try {
    return await fs.readFile(envFilePath(), "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""
    throw error
  }
}

/**
 * Rewrite .env.local so that every key in `updates` is set to its new value,
 * preserving all other lines (comments, unrelated vars, blank lines) verbatim.
 *
 * - An existing active `KEY=...` line is updated in place.
 * - A commented `# KEY=...` line is uncommented and updated (the admin is
 *   opting in by editing it from the dashboard).
 * - A key with no line at all is appended as `KEY=value`.
 *
 * ponytail: line-based rewrite, no full dotenv parser. Ceiling: a value
 * containing a literal newline would break — env values never contain
 * newlines, so this is fine. Upgrade path: dotenv serialize.
 */
async function writeEnvFile(
  current: string,
  updates: Record<string, string>,
): Promise<string> {
  const lines = current.length ? current.split(/\r?\n/) : []
  const remaining = new Map(Object.entries(updates))
  const eol = current.includes("\r\n") ? "\r\n" : "\n"

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Match `KEY=...` or `# KEY=...` (with optional surrounding whitespace).
    const match = line.match(/^\s*#?\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key] = match
    if (!remaining.has(key)) continue

    lines[i] = `${key}=${formatEnvValue(remaining.get(key) ?? "")}`
    remaining.delete(key)
  }

  // Append any keys that had no existing line.
  if (remaining.size > 0) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("")
    }
    for (const [key, value] of remaining) {
      lines.push(`${key}=${formatEnvValue(value)}`)
    }
  }

  const next = lines.join(eol)
  if (next !== current) {
    await fs.writeFile(envFilePath(), next, "utf8")
  }
  return next
}

function formatEnvValue(value: string) {
  if (value === "") return ""
  // Quote only when necessary to avoid surprising the dotenv parser.
  if (/[\s#"'`$]/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`
  }
  return value
}

export async function getEnvSettings(): Promise<EnvSettingView[]> {
  return ENV_SETTINGS_SCHEMA.map((descriptor) => {
    const raw = process.env[descriptor.key] ?? ""
    return {
      ...descriptor,
      hasValue: Boolean(raw),
      masked: descriptor.type === "secret" ? maskSecret(raw) : raw,
    }
  })
}

export class EnvSettingsMutationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = "EnvSettingsMutationError"
    this.status = status
  }
}

export async function updateEnvSettings(input: {
  actor: AdminActor
  changes: Record<string, string>
  reason: string
}): Promise<EnvSettingView[]> {
  const reason = input.reason.trim()
  if (reason.length < 3) {
    throw new EnvSettingsMutationError("A short reason is required for the audit trail.")
  }

  const schemaByKey = new Map(ENV_SETTINGS_SCHEMA.map((d) => [d.key, d]))
  const normalized: Record<string, string> = {}
  const before: Record<string, string> = {}
  const after: Record<string, string> = {}

  for (const [rawKey, rawValue] of Object.entries(input.changes)) {
    const descriptor = schemaByKey.get(rawKey as EnvSettingKey)
    if (!descriptor) {
      throw new EnvSettingsMutationError(`Unknown env key: ${rawKey}`)
    }

    const previousRaw = process.env[descriptor.key] ?? ""

    if (descriptor.type === "secret") {
      // Empty submission = "keep current value". This lets the masked UI round-
      // trip without forcing the admin to retype the key every save.
      if (rawValue === undefined || rawValue === "") {
        continue
      }
      normalized[descriptor.key] = rawValue
      before[descriptor.key] = maskSecret(previousRaw)
      after[descriptor.key] = maskSecret(rawValue)
    } else {
      const trimmed = rawValue.trim()
      if (trimmed === "") {
        // Clearing a numeric timeout = remove override, fall back to default.
        normalized[descriptor.key] = ""
        before[descriptor.key] = previousRaw
        after[descriptor.key] = ""
        continue
      }
      const parsed = Number.parseInt(trimmed, 10)
      if (!Number.isFinite(parsed)) {
        throw new EnvSettingsMutationError(`${descriptor.label} must be a number.`)
      }
      const min = descriptor.min ?? -Infinity
      const max = descriptor.max ?? Infinity
      if (parsed < min || parsed > max) {
        throw new EnvSettingsMutationError(
          `${descriptor.label} must be between ${min} and ${max}.`,
        )
      }
      normalized[descriptor.key] = String(parsed)
      before[descriptor.key] = previousRaw
      after[descriptor.key] = String(parsed)
    }
  }

  if (Object.keys(normalized).length === 0) {
    throw new EnvSettingsMutationError("No changes to save.")
  }

  // 1. Persist to .env.local so the change survives a restart.
  const current = await readEnvFile()
  await writeEnvFile(current, normalized)

  // 2. Update process.env in-memory so the change takes effect immediately
  //    for request-time reads in ai-provider-client.ts without a restart.
  for (const [key, value] of Object.entries(normalized)) {
    if (value === "") {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  await createAdminAuditEntry({
    actorUserId: input.actor.id,
    actorEmail: input.actor.email ?? "",
    actorRole: input.actor.role,
    action: "admin.env-settings.updated",
    permission: "admin:manage-settings",
    targetType: "env-settings",
    reason,
    before,
    after,
  })

  return getEnvSettings()
}
