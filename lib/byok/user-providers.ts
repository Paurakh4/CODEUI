import "server-only"

import connectDB from "@/lib/db"
import { UserApiKey, type IUserApiKey } from "@/lib/models"
import { encrypt, decrypt } from "@/lib/crypto"
import {
  BYOK_SOURCE_PROVIDER,
  buildByokModelId,
  type AIModel,
} from "@/lib/ai-models"

export interface UserProviderView {
  id: string
  name: string
  baseUrl: string
  apiKeyMasked: string
  hasApiKey: boolean
  models: { id: string; name: string; contextLength: number | null }[]
  createdAt: string
  updatedAt: string
}

export interface DetectedByokModel {
  id: string
  name: string
  contextLength: number | null
}

function maskApiKey(key: string) {
  if (!key) return ""
  if (key.length <= 8) return "••••"
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

function toView(provider: IUserApiKey): UserProviderView {
  return {
    id: provider._id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKeyMasked: maskApiKey("••••"),
    hasApiKey: Boolean(provider.apiKeyEncrypted),
    models: (provider.models || []).map((m) => ({
      id: m.id,
      name: m.name,
      contextLength: m.contextLength,
    })),
    createdAt: provider.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: provider.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  }
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

function buildProviderId(name: string, userId: string) {
  const slug = slugify(name) || `provider-${Date.now()}`
  const userHash = userId.slice(-6)
  return `${slug}-${userHash}`
}

export async function listUserProviders(userId: string): Promise<UserProviderView[]> {
  await connectDB()
  const providers = await UserApiKey.find({ userId }).sort({ createdAt: 1 }).lean()
  return providers.map((p) => toView(p as IUserApiKey))
}

export async function createUserProvider(
  userId: string,
  input: { name: string; baseUrl: string; apiKey: string },
): Promise<UserProviderView> {
  const name = input.name.trim()
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const apiKey = input.apiKey.trim()

  if (!name) throw new Error("Provider name is required")
  if (!baseUrl) throw new Error("A valid http(s) base URL is required")
  if (!apiKey) throw new Error("An API key is required")

  let id = buildProviderId(name, userId)
  const existing = await UserApiKey.findById(id).lean()
  if (existing) {
    id = `${id}-${Date.now().toString(36)}`
  }

  const encrypted = encrypt(apiKey)

  await connectDB()
  const created = await UserApiKey.create({
    _id: id,
    userId,
    name,
    baseUrl,
    apiKeyEncrypted: encrypted.ciphertext,
    apiKeyIv: encrypted.iv,
    models: [],
  })

  return toView(created as IUserApiKey)
}

export async function deleteUserProvider(userId: string, providerId: string): Promise<void> {
  await connectDB()
  const provider = await UserApiKey.findById(providerId).lean()
  if (!provider) throw new Error("Provider not found")
  if (provider.userId.toString() !== userId) throw new Error("Provider not found")

  await UserApiKey.findByIdAndDelete(providerId)
}

export async function getDecryptedProvider(
  userId: string,
  providerId: string,
): Promise<{ baseUrl: string; apiKey: string }> {
  await connectDB()
  const provider = await UserApiKey.findById(providerId).lean()
  if (!provider) throw new Error(`BYOK provider "${providerId}" is no longer configured`)
  if (provider.userId.toString() !== userId) throw new Error(`BYOK provider "${providerId}" is no longer configured`)

  const plain = provider as IUserApiKey
  const apiKey = decrypt(plain.apiKeyEncrypted, plain.apiKeyIv)
  return { baseUrl: plain.baseUrl, apiKey }
}

export async function detectUserProviderModels(
  userId: string,
  providerId: string,
): Promise<{ provider: UserProviderView; models: DetectedByokModel[] }> {
  await connectDB()
  const provider = await UserApiKey.findById(providerId).lean()
  if (!provider) throw new Error("Provider not found")
  if (provider.userId.toString() !== userId) throw new Error("Provider not found")

  const plain = provider as IUserApiKey
  const { baseUrl, apiKey } = await getDecryptedProvider(userId, providerId)

  const modelsUrl = `${baseUrl.replace(/\/+$/, "")}/models`

  const response = await fetch(modelsUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

  const detected: DetectedByokModel[] = []
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

export async function enableUserProviderModels(
  userId: string,
  providerId: string,
  models: { id: string; name: string; contextLength: number | null }[],
): Promise<UserProviderView> {
  await connectDB()
  const provider = await UserApiKey.findById(providerId).lean()
  if (!provider) throw new Error("Provider not found")
  if (provider.userId.toString() !== userId) throw new Error("Provider not found")

  const updated = await UserApiKey.findByIdAndUpdate(
    providerId,
    { $set: { models } },
    { new: true },
  ).lean()

  return toView(updated as IUserApiKey)
}

export async function getUserByokModels(userId: string): Promise<AIModel[]> {
  await connectDB()
  const providers = await UserApiKey.find({ userId }).sort({ createdAt: 1 }).lean()

  const models: AIModel[] = []

  for (const provider of providers) {
    const plain = provider as IUserApiKey
    for (const model of plain.models || []) {
      models.push({
        id: buildByokModelId(plain._id, model.id),
        name: model.name,
        provider: plain.name,
        sourceProvider: BYOK_SOURCE_PROVIDER,
        customProviderId: plain._id,
        upstreamModelId: model.id,
        contextLength: model.contextLength ?? 128_000,
      })
    }
  }

  return models
}

export async function getUserByokModelsById(
  userId: string,
): Promise<Map<string, AIModel>> {
  const models = await getUserByokModels(userId)
  return new Map(models.map((m) => [m.id, m]))
}
