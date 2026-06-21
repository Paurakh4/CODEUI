import "server-only"

import connectDB from "@/lib/db"
import { AdminCustomProvider, type IAdminCustomProvider } from "@/lib/models"
import { createAdminAuditEntry } from "@/lib/admin/audit"
import type { UserRole } from "@/lib/admin/rbac"

export interface AdminCustomProviderView {
  id: string
  name: string
  baseUrl: string
  apiKeyMasked: string
  hasApiKey: boolean
  createdAt: string
  updatedAt: string
}

export interface DetectedCustomModel {
  id: string
  name: string
  contextLength: number | null
}

interface AdminActor {
  id: string
  email?: string | null
  role: UserRole
}

function maskApiKey(key: string) {
  if (!key) return ""
  if (key.length <= 8) return "••••"
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

function toView(provider: IAdminCustomProvider | LeanProvider): AdminCustomProviderView {
  // ponytail: accept both Mongoose documents (.toObject()) and lean plain
  // objects. Ceiling: none — lean is the hot path for list/get.
  const plain =
    typeof (provider as IAdminCustomProvider).toObject === "function"
      ? (provider as IAdminCustomProvider).toObject()
      : (provider as LeanProvider)
  return {
    id: plain._id,
    name: plain.name,
    baseUrl: plain.baseUrl,
    apiKeyMasked: maskApiKey(plain.apiKey),
    hasApiKey: Boolean(plain.apiKey),
    createdAt: toIso(plain.createdAt),
    updatedAt: toIso(plain.updatedAt),
  }
}

function toIso(value: unknown) {
  if (!value) return new Date(0).toISOString()
  if (value instanceof Date) return value.toISOString()
  // Mongoose lean returns native Date for timestamp paths, but be defensive.
  return new Date(value as string).toISOString()
}

// Minimal lean shape (plain object from .lean()).
interface LeanProvider {
  _id: string
  name: string
  baseUrl: string
  apiKey: string
  createdAt: Date | string
  updatedAt: Date | string
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed) return ""
  if (!/^https?:\/\//i.test(trimmed)) return ""
  return trimmed
}

export async function listCustomProviders() {
  await connectDB()
  const providers = await AdminCustomProvider.find().sort({ createdAt: 1 }).lean()
  return providers.map((provider) => toView(provider as IAdminCustomProvider))
}

export async function getCustomProviderById(id: string) {
  await connectDB()
  const provider = await AdminCustomProvider.findById(id).lean()
  return (provider as IAdminCustomProvider | null) ?? null
}

export async function createCustomProvider(input: {
  actor: AdminActor
  name: string
  baseUrl: string
  apiKey: string
  reason: string
}) {
  const name = input.name.trim()
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const apiKey = input.apiKey.trim()

  if (!name) throw new Error("Provider name is required")
  if (!baseUrl) throw new Error("A valid http(s) base URL is required")
  if (!apiKey) throw new Error("An API key is required")

  let id = slugify(name) || `provider-${Date.now()}`
  const existing = await AdminCustomProvider.findById(id).lean()
  if (existing) {
    id = `${id}-${Date.now().toString(36)}`
  }

  await connectDB()
  const created = await AdminCustomProvider.create({
    _id: id,
    name,
    baseUrl,
    apiKey,
  })

  await createAdminAuditEntry({
    actorUserId: input.actor.id,
    actorEmail: input.actor.email || "unknown@local",
    actorRole: input.actor.role,
    action: "admin.custom-provider.created",
    permission: "admin:manage-models",
    targetType: "custom-provider",
    targetId: id,
    reason: input.reason,
    after: { id, name, baseUrl },
  })

  return toView(created as IAdminCustomProvider)
}

export async function deleteCustomProvider(input: { actor: AdminActor; id: string; reason: string }) {
  await connectDB()
  const existing = await AdminCustomProvider.findById(input.id).lean()
  if (!existing) {
    throw new Error("Custom provider not found")
  }

  await AdminModelConfig_deleteProvider(input.id)

  await createAdminAuditEntry({
    actorUserId: input.actor.id,
    actorEmail: input.actor.email || "unknown@local",
    actorRole: input.actor.role,
    action: "admin.custom-provider.deleted",
    permission: "admin:manage-models",
    targetType: "custom-provider",
    targetId: input.id,
    reason: input.reason,
    before: { id: input.id, name: (existing as IAdminCustomProvider).name },
  })

  return { id: input.id }
}

// ponytail: tiny helper kept inline to avoid pulling AdminModelConfig import
// churn into the top of the file. Ceiling: none.
async function AdminModelConfig_deleteProvider(providerId: string) {
  const { AdminModelConfig } = await import("@/lib/models")
  const config = await AdminModelConfig.findById("global").lean()
  if (!config) return
  const models = (config.models || []).filter(
    (model) => model.customProviderId !== providerId,
  )
  const removedIds = (config.models || [])
    .filter((model) => model.customProviderId === providerId)
    .map((model) => model.id)
  const enabledModelIds = (config.enabledModelIds || []).filter(
    (id) => !removedIds.includes(id),
  )
  await AdminModelConfig.findByIdAndUpdate("global", {
    $set: { models, enabledModelIds },
  })
}

export async function detectCustomProviderModels(input: { id: string }) {
  await connectDB()
  const provider = await AdminCustomProvider.findById(input.id).lean()
  if (!provider) {
    throw new Error("Custom provider not found")
  }

  const plain = provider as IAdminCustomProvider
  const modelsUrl = `${plain.baseUrl.replace(/\/+$/, "")}/models`

  const response = await fetch(modelsUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${plain.apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as Record<string, unknown>).error)
        : `Upstream responded ${response.status}`
    throw new Error(`Failed to detect models: ${detail}`)
  }

  const rawModels = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : []

  const detected: DetectedCustomModel[] = []
  const seen = new Set<string>()

  for (const entry of rawModels) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as Record<string, unknown>
    const id = typeof record.id === "string" ? record.id.trim() : ""
    if (!id || seen.has(id)) continue
    seen.add(id)

    const name =
      (typeof record.name === "string" ? record.name.trim() : "") || id

    const contextLength =
      typeof record.context_length === "number" && record.context_length > 0
        ? record.context_length
        : typeof record.max_tokens === "number" && record.max_tokens > 0
          ? record.max_tokens
          : null

    detected.push({ id, name, contextLength })
  }

  detected.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  return { provider: toView(plain), models: detected }
}
