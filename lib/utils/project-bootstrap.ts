interface PendingProjectStart {
  prompt?: string
  model?: string
  createdAt: number
}

const PENDING_PROJECT_START_TTL_MS = 10 * 60 * 1000

function getPendingProjectStartKey(projectId: string): string {
  return `pending_project_start_${projectId}`
}

function normalizePendingProjectStart(value: unknown): PendingProjectStart | null {
  if (!value || typeof value !== "object") return null

  const candidate = value as Record<string, unknown>
  const prompt = typeof candidate.prompt === "string" && candidate.prompt.trim() ? candidate.prompt : undefined
  const model = typeof candidate.model === "string" && candidate.model.trim() ? candidate.model : undefined
  const createdAt = typeof candidate.createdAt === "number" ? candidate.createdAt : 0

  if (!prompt && !model) return null
  if (!createdAt || Date.now() - createdAt > PENDING_PROJECT_START_TTL_MS) return null

  return { prompt, model, createdAt }
}

export function storePendingProjectStart(projectId: string, payload: { prompt?: string; model?: string }) {
  if (typeof window === "undefined") return
  if (!payload.prompt && !payload.model) return

  const record: PendingProjectStart = {
    prompt: payload.prompt,
    model: payload.model,
    createdAt: Date.now(),
  }

  window.sessionStorage.setItem(getPendingProjectStartKey(projectId), JSON.stringify(record))
}

export function consumePendingProjectStart(projectId: string): { prompt?: string; model?: string } | null {
  if (typeof window === "undefined") return null

  const key = getPendingProjectStartKey(projectId)
  const rawValue = window.sessionStorage.getItem(key)
  if (!rawValue) return null

  window.sessionStorage.removeItem(key)

  try {
    const normalized = normalizePendingProjectStart(JSON.parse(rawValue))
    if (!normalized) return null

    return {
      prompt: normalized.prompt,
      model: normalized.model,
    }
  } catch {
    return null
  }
}
