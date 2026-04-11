"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AdminModelCatalogEntry } from "@/lib/admin/model-policies"

interface ModelPolicyFormProps {
  models: AdminModelCatalogEntry[]
  defaultModelId: string
  readOnly?: boolean
  readOnlyReason?: string
}

export function ModelPolicyForm({
  models,
  defaultModelId,
  readOnly = false,
  readOnlyReason,
}: ModelPolicyFormProps) {
  const router = useRouter()
  const [enabledModelIds, setEnabledModelIds] = useState<string[]>(
    models.filter((model) => model.enabled).map((model) => model.id),
  )
  const [selectedDefaultModelId, setSelectedDefaultModelId] = useState(defaultModelId)
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = useMemo(() => {
    const initialEnabled = models.filter((model) => model.enabled).map((model) => model.id)

    return (
      initialEnabled.join("|") !== enabledModelIds.join("|") ||
      defaultModelId !== selectedDefaultModelId
    )
  }, [defaultModelId, enabledModelIds, models, selectedDefaultModelId])

  const enabledModelSet = useMemo(() => new Set(enabledModelIds), [enabledModelIds])
  const availableDefaultOptions = models.filter((model) => enabledModelSet.has(model.id))

  const toggleModel = (modelId: string) => {
    setEnabledModelIds((current) => {
      if (current.includes(modelId)) {
        const next = current.filter((id) => id !== modelId)
        if (next.length === 0) {
          return current
        }

        if (selectedDefaultModelId === modelId) {
          setSelectedDefaultModelId(next[0])
        }

        return next
      }

      return [...current, modelId]
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (readOnly) {
      return
    }

    if (!hasChanges) {
      setError("Adjust the enabled model list or default model first.")
      return
    }

    if (enabledModelIds.length === 0) {
      setError("At least one model must remain enabled.")
      return
    }

    if (reason.trim().length < 3) {
      setError("Enter a short reason so the model policy audit trail is clear.")
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch("/api/admin/models", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabledModelIds,
          defaultModelId: selectedDefaultModelId,
          reason: reason.trim(),
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update model policy")
      }

      setReason("")
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update model policy")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {readOnlyReason ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          {readOnlyReason}
        </div>
      ) : null}

      <div className="space-y-3">
        {models.map((model) => {
          const isEnabled = enabledModelSet.has(model.id)

          return (
            <label
              key={model.id}
              className="flex cursor-pointer items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4"
            >
              <input
                type="checkbox"
                checked={isEnabled}
                disabled={readOnly || isSaving || (isEnabled && enabledModelIds.length === 1)}
                onChange={() => toggleModel(model.id)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-[#0B0C0D] text-[#0AA6FF]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{model.name}</p>
                  {model.isDefault ? (
                    <span className="rounded-full border border-[#0AA6FF]/30 bg-[#0AA6FF]/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-[#7FD0FF]">
                      Current default
                    </span>
                  ) : null}
                  {model.envEnabled ? (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-[#A6A6A6]">
                      Env enabled
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[#D6D8DA]">{model.description}</p>
                <p className="mt-2 text-xs text-[#A6A6A6]">
                  {model.provider} · {(model.contextLength / 1000).toFixed(0)}K context{model.supportsReasoning ? " · Reasoning" : ""}{model.isFast ? " · Fast" : ""}
                </p>
              </div>
            </label>
          )
        })}
      </div>

      <label className="space-y-2 text-sm text-[#D6D8DA]">
        <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Default Model</span>
        <select
          value={selectedDefaultModelId}
          onChange={(event) => setSelectedDefaultModelId(event.target.value)}
          disabled={readOnly || isSaving}
          className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {availableDefaultOptions.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2 text-sm text-[#D6D8DA]">
        <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Audit Reason</span>
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={readOnly || isSaving}
          className="h-10 rounded-xl border-white/10 bg-[#0B0C0D] text-white"
          placeholder="Why are you changing model availability?"
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[#A6A6A6]">
          Enabled models are used by the public model API, generation validation, and user preference defaults.
        </p>
        <Button
          type="submit"
          disabled={readOnly || isSaving || !hasChanges}
          className="rounded-xl bg-[#0AA6FF] text-white hover:bg-[#0AA6FF]/90"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Model Policy
        </Button>
      </div>
    </form>
  )
}