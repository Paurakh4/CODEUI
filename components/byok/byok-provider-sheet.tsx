"use client"

import { useCallback, useEffect, useState } from "react"
import { Key, Loader2, Plus, RefreshCw, Trash2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "sonner"

interface ByokProviderView {
  id: string
  name: string
  baseUrl: string
  apiKeyMasked: string
  hasApiKey: boolean
  models: { id: string; name: string; contextLength: number | null }[]
  createdAt: string
  updatedAt: string
}

interface DetectedModel {
  id: string
  name: string
  contextLength: number | null
}

interface ByokPreset {
  id: string
  name: string
  baseUrl: string
  description: string
}

const BYOK_PRESETS: ByokPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    description: "Use your OpenAI API key to access GPT models directly.",
  },
  {
    id: "anthropic",
    name: "Anthropic (via proxy)",
    baseUrl: "",
    description:
      "Anthropic's native API is not OpenAI-compatible. Use a proxy/gateway URL (e.g. OpenRouter or a custom Anthropic-to-OpenAI adapter) that exposes /v1/chat/completions.",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    description: "Use your DeepSeek API key to access DeepSeek models.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    description:
      "Use your OpenRouter API key to access hundreds of models through a single endpoint.",
  },
  {
    id: "custom",
    name: "Custom",
    baseUrl: "",
    description:
      "Any OpenAI-compatible endpoint. Provide a Base URL and API key.",
  },
]

interface ByokProviderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProvidersChanged?: () => void
}

export function ByokProviderSheet({
  open,
  onOpenChange,
  onProvidersChanged,
}: ByokProviderSheetProps) {
  const [providers, setProviders] = useState<ByokProviderView[]>([])
  const [isLoadingProviders, setIsLoadingProviders] = useState(false)
  const [newProvider, setNewProvider] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
  })
  const [isSavingProvider, setIsSavingProvider] = useState(false)
  const [providerError, setProviderError] = useState<string | null>(null)

  const [detectingProviderId, setDetectingProviderId] = useState<string | null>(null)
  const [detectedForProviderId, setDetectedForProviderId] = useState<string | null>(null)
  const [detectedModels, setDetectedModels] = useState<DetectedModel[]>([])
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set())
  const [isSavingModels, setIsSavingModels] = useState(false)

  const fetchProviders = useCallback(async () => {
    setIsLoadingProviders(true)
    try {
      const res = await fetch("/api/user/providers", { cache: "no-store" })
      const data = await res.json()
      if (data.providers) {
        setProviders(data.providers)
      }
    } catch {
      toast.error("Failed to load providers")
    } finally {
      setIsLoadingProviders(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchProviders()
    }
  }, [open, fetchProviders])

  function applyPreset(preset: ByokPreset) {
    setNewProvider((current) => ({
      ...current,
      name: current.name || preset.name,
      baseUrl: current.baseUrl || preset.baseUrl,
    }))
  }

  async function handleCreateProvider() {
    const name = newProvider.name.trim()
    const baseUrl = newProvider.baseUrl.trim()
    const apiKey = newProvider.apiKey.trim()

    if (!name || !baseUrl || !apiKey) {
      setProviderError("Provider name, base URL, and API key are all required.")
      return
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      setProviderError("Base URL must start with http:// or https://")
      return
    }

    try {
      setIsSavingProvider(true)
      setProviderError(null)
      const response = await fetch("/api/user/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, baseUrl, apiKey }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to create provider")

      const created = data?.provider as ByokProviderView | undefined
      if (created) {
        setProviders((current) => [...current, created])
        setNewProvider({ name: "", baseUrl: "", apiKey: "" })
        onProvidersChanged?.()
        toast.success("Provider added", {
          description: `${created.name} is ready. Detect models to enable them.`,
        })
        handleDetectModels(created.id)
      }
    } catch (error) {
      setProviderError(
        error instanceof Error ? error.message : "Failed to create provider",
      )
    } finally {
      setIsSavingProvider(false)
    }
  }

  async function handleDetectModels(providerId: string) {
    setDetectingProviderId(providerId)
    setDetectedForProviderId(providerId)
    setDetectedModels([])
    setSelectedModelIds(new Set())

    try {
      const response = await fetch(`/api/user/providers/${providerId}/detect`, {
        method: "POST",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Failed to detect models")

      const models = (data.models || []) as DetectedModel[]
      setDetectedModels(models)

      const provider = providers.find((p) => p.id === providerId)
      if (provider) {
        const existingIds = new Set(provider.models.map((m) => m.id))
        setSelectedModelIds(existingIds)
      }
    } catch (error) {
      toast.error("Model detection failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setDetectingProviderId(null)
    }
  }

  async function handleSaveModels(providerId: string) {
    const models = detectedModels.filter((m) => selectedModelIds.has(m.id))
    if (models.length === 0) {
      toast.error("Select at least one model to enable")
      return
    }

    try {
      setIsSavingModels(true)
      const response = await fetch(`/api/user/providers/${providerId}/models`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          models: models.map((m) => ({
            id: m.id,
            name: m.name,
            contextLength: m.contextLength,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Failed to save models")

      const updated = data.provider as ByokProviderView
      setProviders((current) =>
        current.map((p) => (p.id === providerId ? updated : p)),
      )
      setDetectedModels([])
      setSelectedModelIds(new Set())
      onProvidersChanged?.()
      toast.success(`Enabled ${models.length} model${models.length > 1 ? "s" : ""}`)
    } catch (error) {
      toast.error("Failed to save models", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsSavingModels(false)
    }
  }

  async function handleDeleteProvider(providerId: string) {
    try {
      const response = await fetch(`/api/user/providers/${providerId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete provider")
      }
      setProviders((current) => current.filter((p) => p.id !== providerId))
      onProvidersChanged?.()
      toast.success("Provider removed")
    } catch (error) {
      toast.error("Failed to delete provider", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  function toggleModel(modelId: string) {
    setSelectedModelIds((current) => {
      const next = new Set(current)
      if (next.has(modelId)) {
        next.delete(modelId)
      } else {
        next.add(modelId)
      }
      return next
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base font-medium">
            <Key className="w-4 h-4 text-purple-400" />
            Bring Your Own Key
          </SheetTitle>
          <SheetDescription className="text-xs text-[#9B9B9F]">
            Connect your own LLM provider account. BYOK requests bypass platform
            credits — you only pay your provider directly.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          {/* Existing providers */}
          {isLoadingProviders ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#9B9B9F]" />
            </div>
          ) : providers.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Connected Providers</h3>
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-lg border border-white/[0.04] bg-[#050505] p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{provider.name}</p>
                      <p className="text-[11px] text-[#9B9B9F] truncate">
                        {provider.baseUrl}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={detectingProviderId === provider.id}
                        onClick={() => handleDetectModels(provider.id)}
                        className="h-7 px-2 text-[11px]"
                      >
                        {detectingProviderId === provider.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        <span className="ml-1">Detect</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteProvider(provider.id)}
                        className="h-7 px-2 text-[11px] text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {provider.models.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {provider.models.map((model) => (
                        <span
                          key={model.id}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[#9B9B9F]"
                        >
                          {model.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {/* Detected models list */}
          {detectedModels.length > 0 && detectingProviderId === null && (
            <div className="space-y-3 rounded-lg border border-white/[0.04] bg-[#050505] p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Detected Models</h3>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSavingModels}
                  onClick={() => {
                    if (detectedForProviderId) handleSaveModels(detectedForProviderId)
                  }}
                  className="h-7 text-[11px]"
                >
                  {isSavingModels ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  <span className="ml-1">Save selected</span>
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {detectedModels.map((model) => (
                  <label
                    key={model.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/[0.03] cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedModelIds.has(model.id)}
                      onCheckedChange={() => toggleModel(model.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{model.name}</p>
                      <p className="text-[10px] text-[#9B9B9F] truncate">{model.id}</p>
                    </div>
                    {model.contextLength && (
                      <span className="text-[10px] text-[#9B9B9F]">
                        {(model.contextLength / 1000).toFixed(0)}K
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Add new provider */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Add New Provider</h3>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              {BYOK_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSavingProvider}
                  onClick={() => applyPreset(preset)}
                  className="rounded-lg"
                  title={preset.description}
                >
                  {preset.name}
                </Button>
              ))}
            </div>

            {/* Form */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  Provider Name
                </Label>
                <Input
                  value={newProvider.name}
                  onChange={(e) =>
                    setNewProvider((c) => ({ ...c, name: e.target.value }))
                  }
                  disabled={isSavingProvider}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#050505] text-[#E7E7E9]"
                  placeholder="OpenAI"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  Base URL
                </Label>
                <Input
                  value={newProvider.baseUrl}
                  onChange={(e) =>
                    setNewProvider((c) => ({ ...c, baseUrl: e.target.value }))
                  }
                  disabled={isSavingProvider}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#050505] text-[#E7E7E9]"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  API Key
                </Label>
                <Input
                  type="password"
                  value={newProvider.apiKey}
                  onChange={(e) =>
                    setNewProvider((c) => ({ ...c, apiKey: e.target.value }))
                  }
                  disabled={isSavingProvider}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#050505] text-[#E7E7E9]"
                  placeholder="sk-..."
                />
              </div>
            </div>

            {providerError && (
              <p className="text-xs text-red-400">{providerError}</p>
            )}

            <Button
              type="button"
              disabled={isSavingProvider}
              onClick={handleCreateProvider}
              className="w-full h-10 rounded-lg"
            >
              {isSavingProvider ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span className="ml-2">Add Provider</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
