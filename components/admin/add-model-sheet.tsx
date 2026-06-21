"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronsUpDown, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  CUSTOM_SOURCE_PROVIDER,
  OPENROUTER_SOURCE_PROVIDER,
  PXROUTE_SOURCE_PROVIDER,
  buildCustomModelId,
} from "@/lib/ai-models"

interface EditableModel {
  id: string
  name: string
  provider: string
  sourceProvider?: "openrouter" | "pxroute" | "custom"
  customProviderId?: string
  upstreamModelId?: string
  description: string
  contextLength: number
  supportsReasoning: boolean
  isFast: boolean
  isNewModel: boolean
  enabled: boolean
  envEnabled: boolean
  isCustom: boolean
}

interface NewModelDraft {
  id: string
  name: string
  provider: string
  sourceProvider: "openrouter" | "pxroute"
  description: string
  contextLength: string
  supportsReasoning: boolean
  isFast: boolean
  isNewModel: boolean
  enabled: boolean
  makeDefault: boolean
}

interface OpenRouterModelOption {
  id: string
  name: string
  provider: string
  sourceProvider: "openrouter" | "pxroute" | "custom"
  description: string
  contextLength: number
  supportsReasoning: boolean
  isFast: boolean
  isNewModel: boolean
  isFree: boolean
}

interface CustomProviderView {
  id: string
  name: string
  baseUrl: string
  apiKeyMasked: string
  hasApiKey: boolean
}

interface DetectedCustomModel {
  id: string
  name: string
  contextLength: number | null
}

interface CustomProviderPreset {
  id: string
  name: string
  baseUrl: string
  description: string
  freeModelIds: string[]
}

const CUSTOM_PROVIDER_PRESETS: CustomProviderPreset[] = [
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    description:
      "Curated OpenAI-compatible gateway from the OpenCode team. Free models: Big Pickle, DeepSeek V4 Flash Free, MiMo-V2.5 Free, North Mini Code Free, Nemotron 3 Ultra Free.",
    freeModelIds: [
      "big-pickle",
      "deepseek-v4-flash-free",
      "mimo-v2.5-free",
      "north-mini-code-free",
      "nemotron-3-ultra-free",
    ],
  },
  {
    id: "kilo-gateway",
    name: "Kilo Gateway",
    baseUrl: "https://api.kilo.ai/api/gateway",
    description:
      "Kilo Code's OpenAI-compatible gateway. Hundreds of models behind one key (anthropic/claude-sonnet-4.5, openai/gpt-5, etc.).",
    freeModelIds: [],
  },
]

type OpenRouterFilter = "all" | "reasoning" | "fast" | "free"

const OPENROUTER_FILTERS: Array<{ value: OpenRouterFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "reasoning", label: "Reasoning" },
  { value: "fast", label: "Fast" },
  { value: "free", label: "Free" },
]

const PXROUTE_PRESET_MODELS: OpenRouterModelOption[] = [
  {
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Latest flagship - smartest, slowest, priciest",
    contextLength: 200000,
    supportsReasoning: true,
    isFast: false,
    isNewModel: true,
    isFree: false,
  },
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Previous flagship",
    contextLength: 200000,
    supportsReasoning: true,
    isFast: false,
    isNewModel: false,
    isFree: false,
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Older flagship",
    contextLength: 200000,
    supportsReasoning: true,
    isFast: false,
    isNewModel: false,
    isFree: false,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Balanced - recommended default",
    contextLength: 200000,
    supportsReasoning: true,
    isFast: true,
    isNewModel: true,
    isFree: false,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Fast and cheap, good for high-volume",
    contextLength: 200000,
    supportsReasoning: false,
    isFast: true,
    isNewModel: false,
    isFree: false,
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Latest GPT - strong general reasoning",
    contextLength: 400000,
    supportsReasoning: true,
    isFast: false,
    isNewModel: true,
    isFree: false,
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Stable GPT flagship",
    contextLength: 400000,
    supportsReasoning: true,
    isFast: false,
    isNewModel: false,
    isFree: false,
  },
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Code-specialized",
    contextLength: 400000,
    supportsReasoning: true,
    isFast: true,
    isNewModel: false,
    isFree: false,
  },
]

function createEmptyNewModel(): NewModelDraft {
  return {
    id: "",
    name: "",
    provider: "",
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "",
    contextLength: "128000",
    supportsReasoning: false,
    isFast: false,
    isNewModel: false,
    enabled: true,
    makeDefault: false,
  }
}

function formatContextLength(contextLength: number) {
  if (contextLength >= 1000) return `${(contextLength / 1000).toFixed(0)}K`
  return String(contextLength)
}

function toEditableModel(model: OpenRouterModelOption): EditableModel {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    sourceProvider: model.sourceProvider,
    description: model.description,
    contextLength: model.contextLength,
    supportsReasoning: model.supportsReasoning,
    isFast: model.isFast,
    isNewModel: model.isNewModel,
    enabled: true,
    envEnabled: false,
    isCustom: true,
  }
}

function toCustomEditableModel(
  provider: CustomProviderView,
  detected: DetectedCustomModel,
): EditableModel {
  const catalogId = buildCustomModelId(provider.id, detected.id)
  const isFree = /free/i.test(detected.id)
  return {
    id: catalogId,
    name: detected.name,
    provider: provider.name,
    sourceProvider: CUSTOM_SOURCE_PROVIDER,
    customProviderId: provider.id,
    upstreamModelId: detected.id,
    description: isFree ? "Free model via custom provider" : "Model via custom provider",
    contextLength: detected.contextLength ?? 128000,
    supportsReasoning: false,
    isFast: /flash|lite|mini|nano|turbo|haiku/i.test(detected.id),
    isNewModel: isFree,
    enabled: true,
    envEnabled: false,
    isCustom: true,
  }
}

interface AddModelSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingModelIds: Set<string>
  onAddModels: (models: EditableModel[], makeDefaultId?: string) => void
  readOnly?: boolean
}

export function AddModelSheet({
  open,
  onOpenChange,
  existingModelIds,
  onAddModels,
  readOnly = false,
}: AddModelSheetProps) {
  const [newModel, setNewModel] = useState<NewModelDraft>(() => createEmptyNewModel())
  const [isOpenRouterPopoverOpen, setIsOpenRouterPopoverOpen] = useState(false)
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModelOption[]>([])
  const [selectedOpenRouterModelIds, setSelectedOpenRouterModelIds] = useState<string[]>([])
  const [openRouterFilter, setOpenRouterFilter] = useState<OpenRouterFilter>("all")
  const [isLoadingOpenRouterModels, setIsLoadingOpenRouterModels] = useState(false)
  const [openRouterError, setOpenRouterError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Custom OpenAI-compatible provider state
  const [customProviders, setCustomProviders] = useState<CustomProviderView[]>([])
  const [isLoadingCustomProviders, setIsLoadingCustomProviders] = useState(false)
  const [customProviderError, setCustomProviderError] = useState<string | null>(null)
  const [newProvider, setNewProvider] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
    reason: "",
  })
  const [isSavingProvider, setIsSavingProvider] = useState(false)
  const [detectedModelsByProvider, setDetectedModelsByProvider] = useState<
    Record<string, DetectedCustomModel[]>
  >({})
  const [selectedCustomModelIds, setSelectedCustomModelIds] = useState<string[]>([])
  const [detectingProviderId, setDetectingProviderId] = useState<string | null>(null)
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(null)

  const selectedOpenRouterModelIdSet = useMemo(
    () => new Set(selectedOpenRouterModelIds),
    [selectedOpenRouterModelIds],
  )
  const filteredOpenRouterModels = useMemo(() => {
    return openRouterModels.filter((model) => {
      if (openRouterFilter === "reasoning") return model.supportsReasoning
      if (openRouterFilter === "fast") return model.isFast
      if (openRouterFilter === "free") return model.isFree
      return true
    })
  }, [openRouterFilter, openRouterModels])
  const selectedOpenRouterModels = useMemo(
    () => openRouterModels.filter((model) => selectedOpenRouterModelIdSet.has(model.id)),
    [openRouterModels, selectedOpenRouterModelIdSet],
  )

  async function loadOpenRouterModels(force = false) {
    if (isLoadingOpenRouterModels) return
    if (!force && openRouterModels.length > 0) return

    try {
      setIsLoadingOpenRouterModels(true)
      setOpenRouterError(null)
      const response = await fetch("/api/admin/models/openrouter", {
        method: "GET",
        cache: "no-store",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to load OpenRouter models")
      const loadedModels = Array.isArray(data?.models) ? (data.models as OpenRouterModelOption[]) : []
      setOpenRouterModels(loadedModels)
      setSelectedOpenRouterModelIds((current) =>
        current.filter((modelId) => loadedModels.some((model) => model.id === modelId)),
      )
    } catch (loadError) {
      setOpenRouterError(loadError instanceof Error ? loadError.message : "Failed to load OpenRouter models")
    } finally {
      setIsLoadingOpenRouterModels(false)
    }
  }

  useEffect(() => {
    if (open && openRouterModels.length === 0 && !isLoadingOpenRouterModels) {
      void loadOpenRouterModels()
    }
  }, [open, isLoadingOpenRouterModels, openRouterModels.length])

  useEffect(() => {
    if (open && customProviders.length === 0 && !isLoadingCustomProviders) {
      void loadCustomProviders()
    }
  }, [open, isLoadingCustomProviders, customProviders.length])

  async function loadCustomProviders() {
    if (isLoadingCustomProviders) return
    try {
      setIsLoadingCustomProviders(true)
      setCustomProviderError(null)
      const response = await fetch("/api/admin/models/custom-providers", {
        method: "GET",
        cache: "no-store",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to load custom providers")
      setCustomProviders(Array.isArray(data?.providers) ? (data.providers as CustomProviderView[]) : [])
    } catch (loadError) {
      setCustomProviderError(
        loadError instanceof Error ? loadError.message : "Failed to load custom providers",
      )
    } finally {
      setIsLoadingCustomProviders(false)
    }
  }

  function applyPreset(preset: CustomProviderPreset) {
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
    const reason = newProvider.reason.trim()

    if (!name || !baseUrl || !apiKey) {
      setCustomProviderError("Provider name, base URL, and API key are all required.")
      return
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      setCustomProviderError("Base URL must start with http:// or https://")
      return
    }
    if (reason.length < 3) {
      setCustomProviderError("Provide a short audit reason (3+ characters).")
      return
    }

    try {
      setIsSavingProvider(true)
      setCustomProviderError(null)
      const response = await fetch("/api/admin/models/custom-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, baseUrl, apiKey, reason }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to create provider")
      const created = data?.provider as CustomProviderView | undefined
      if (created) {
        setCustomProviders((current) => [...current, created])
      }
      setNewProvider({ name: "", baseUrl: "", apiKey: "", reason: "" })
    } catch (createError) {
      setCustomProviderError(
        createError instanceof Error ? createError.message : "Failed to create provider",
      )
    } finally {
      setIsSavingProvider(false)
    }
  }

  async function handleDetectModels(providerId: string) {
    if (detectingProviderId) return
    try {
      setDetectingProviderId(providerId)
      setCustomProviderError(null)
      const response = await fetch(
        `/api/admin/models/custom-providers/${encodeURIComponent(providerId)}/detect`,
        { method: "POST", cache: "no-store" },
      )
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to detect models")
      const models = Array.isArray(data?.models) ? (data.models as DetectedCustomModel[]) : []
      setDetectedModelsByProvider((current) => ({ ...current, [providerId]: models }))
      setSelectedCustomModelIds((current) =>
        current.filter((catalogId) => {
          const match = /^custom:([^:]+):/.exec(catalogId)
          return !match || match[1] !== providerId
        }),
      )
    } catch (detectError) {
      setCustomProviderError(
        detectError instanceof Error ? detectError.message : "Failed to detect models",
      )
    } finally {
      setDetectingProviderId(null)
    }
  }

  async function handleDeleteProvider(providerId: string) {
    if (deletingProviderId) return
    const reason = window.prompt("Why are you deleting this custom provider? (audit reason)")
    if (!reason || reason.trim().length < 3) return

    try {
      setDeletingProviderId(providerId)
      setCustomProviderError(null)
      const response = await fetch(
        `/api/admin/models/custom-providers/${encodeURIComponent(providerId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      )
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to delete provider")
      setCustomProviders((current) => current.filter((p) => p.id !== providerId))
      setDetectedModelsByProvider((current) => {
        const next = { ...current }
        delete next[providerId]
        return next
      })
    } catch (deleteError) {
      setCustomProviderError(
        deleteError instanceof Error ? deleteError.message : "Failed to delete provider",
      )
    } finally {
      setDeletingProviderId(null)
    }
  }

  function toggleCustomModelSelection(provider: CustomProviderView, detected: DetectedCustomModel) {
    const catalogId = buildCustomModelId(provider.id, detected.id)
    if (existingModelIds.has(catalogId)) return
    setSelectedCustomModelIds((current) =>
      current.includes(catalogId)
        ? current.filter((id) => id !== catalogId)
        : [...current, catalogId],
    )
  }

  function handleAddSelectedCustomModels(provider: CustomProviderView) {
    const detected = detectedModelsByProvider[provider.id] ?? []
    const modelsToAdd = detected
      .filter((m) => selectedCustomModelIds.includes(buildCustomModelId(provider.id, m.id)))
      .filter((m) => !existingModelIds.has(buildCustomModelId(provider.id, m.id)))

    if (modelsToAdd.length === 0) {
      setCustomProviderError("Select at least one model that is not already in the catalog.")
      return
    }

    onAddModels(modelsToAdd.map((m) => toCustomEditableModel(provider, m)))
    setSelectedCustomModelIds((current) =>
      current.filter((id) => !id.startsWith(`custom:${provider.id}:`)),
    )
    setCustomProviderError(null)
  }

  function handleAddManualModel() {
    const id = newModel.id.trim()
    const name = newModel.name.trim()
    const provider = newModel.provider.trim()
    const sourceProvider = provider === "PxRoute" ? PXROUTE_SOURCE_PROVIDER : newModel.sourceProvider
    const description = newModel.description.trim()
    const contextLength = Number.parseInt(newModel.contextLength, 10)

    if (!id || !name || !provider || !Number.isFinite(contextLength) || contextLength <= 0) {
      setError("Provide a model ID, visible name, provider, and a valid positive context window.")
      return
    }

    if (existingModelIds.has(id)) {
      setError("A model with that ID already exists in the catalog.")
      return
    }

    if (!newModel.enabled && newModel.makeDefault) {
      setError("A default model must be enabled.")
      return
    }

    const model: EditableModel = {
      id,
      name,
      provider,
      sourceProvider,
      description,
      contextLength,
      supportsReasoning: newModel.supportsReasoning,
      isFast: newModel.isFast,
      isNewModel: newModel.isNewModel,
      enabled: newModel.enabled,
      envEnabled: false,
      isCustom: true,
    }

    onAddModels([model], newModel.makeDefault ? id : undefined)
    setNewModel(createEmptyNewModel())
    setError(null)
  }

  function handleAddSelectedOpenRouterModels() {
    if (selectedOpenRouterModelIds.length === 0) {
      setOpenRouterError("Select at least one OpenRouter model first.")
      return
    }

    const modelsToAdd = openRouterModels
      .filter((model) => selectedOpenRouterModelIdSet.has(model.id))
      .filter((model) => !existingModelIds.has(model.id))

    if (modelsToAdd.length === 0) {
      setOpenRouterError("Selected OpenRouter models are already in the catalog.")
      return
    }

    onAddModels(modelsToAdd.map(toEditableModel))
    setSelectedOpenRouterModelIds([])
    setIsOpenRouterPopoverOpen(false)
    setOpenRouterError(null)
    setError(null)
  }

  function handleAddPxRoutePresets() {
    const modelsToAdd = PXROUTE_PRESET_MODELS.filter((model) => !existingModelIds.has(model.id))

    if (modelsToAdd.length === 0) {
      setError("All PxRoute preset models are already in the catalog.")
      return
    }

    onAddModels(modelsToAdd.map(toEditableModel))
    setOpenRouterError(null)
    setError(null)
  }

  function toggleOpenRouterSelection(modelId: string) {
    if (existingModelIds.has(modelId)) return
    setSelectedOpenRouterModelIds((current) =>
      current.includes(modelId)
        ? current.filter((candidateId) => candidateId !== modelId)
        : [...current, modelId],
    )
    setOpenRouterError(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add Models</SheetTitle>
          <SheetDescription>
            Add a custom OpenAI-compatible provider, add a custom model manually,
            or import from OpenRouter.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6">
          {/* Custom OpenAI-compatible provider */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Custom OpenAI-Compatible Provider</h3>
              <p className="text-xs text-[#9B9B9F]">
                Add any provider that exposes an OpenAI-compatible <code>/v1/chat/completions</code>{" "}
                endpoint. After saving, click <strong>Detect Models</strong> to pull the live model
                list from <code>/models</code> and pick the ones you want.
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              {CUSTOM_PROVIDER_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={readOnly || isSavingProvider}
                  onClick={() => applyPreset(preset)}
                  className="rounded-lg"
                  title={preset.description}
                >
                  Use {preset.name} preset
                </Button>
              ))}
            </div>

            {/* New provider form */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  Provider Name
                </Label>
                <Input
                  value={newProvider.name}
                  onChange={(e) => setNewProvider((c) => ({ ...c, name: e.target.value }))}
                  disabled={readOnly || isSavingProvider}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                  placeholder="OpenCode Zen"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  Base URL
                </Label>
                <Input
                  value={newProvider.baseUrl}
                  onChange={(e) => setNewProvider((c) => ({ ...c, baseUrl: e.target.value }))}
                  disabled={readOnly || isSavingProvider}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                  placeholder="https://opencode.ai/zen/v1"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  API Key
                </Label>
                <Input
                  type="password"
                  value={newProvider.apiKey}
                  onChange={(e) => setNewProvider((c) => ({ ...c, apiKey: e.target.value }))}
                  disabled={readOnly || isSavingProvider}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                  placeholder="sk-..."
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  Audit Reason
                </Label>
                <Input
                  value={newProvider.reason}
                  onChange={(e) => setNewProvider((c) => ({ ...c, reason: e.target.value }))}
                  disabled={readOnly || isSavingProvider}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                  placeholder="Why are you adding this provider?"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleCreateProvider}
              disabled={readOnly || isSavingProvider}
              className="w-full rounded-xl"
            >
              {isSavingProvider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Save Provider
            </Button>

            {/* Existing providers + detect */}
            {customProviders.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-[#9B9B9F]">Saved Providers</p>
                {customProviders.map((provider) => {
                  const detected = detectedModelsByProvider[provider.id] ?? []
                  return (
                    <div
                      key={provider.id}
                      className="space-y-3 rounded-lg border border-white/[0.04] bg-[#0E0E10] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{provider.name}</span>
                            <Badge
                              variant="outline"
                              className="border-violet-500/20 bg-violet-500/10 text-violet-200 text-[10px]"
                            >
                              Custom
                            </Badge>
                          </div>
                          <p className="truncate text-xs text-[#9B9B9F]">{provider.baseUrl}</p>
                          <p className="text-xs text-[#9B9B9F]">Key: {provider.apiKeyMasked}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={readOnly || detectingProviderId === provider.id}
                            onClick={() => void handleDetectModels(provider.id)}
                            className="rounded-lg"
                          >
                            {detectingProviderId === provider.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Detect Models
                          </Button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteProvider(provider.id)}
                            disabled={readOnly || deletingProviderId === provider.id}
                            className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                            title="Delete provider"
                          >
                            {deletingProviderId === provider.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {detected.length > 0 ? (
                        <div className="space-y-2">
                          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white/[0.04]">
                            {detected.map((model) => {
                              const catalogId = buildCustomModelId(provider.id, model.id)
                              const alreadyAdded = existingModelIds.has(catalogId)
                              const isSelected = selectedCustomModelIds.includes(catalogId)
                              const isFree = /free/i.test(model.id)
                              return (
                                <label
                                  key={model.id}
                                  className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                                    alreadyAdded
                                      ? "opacity-50"
                                      : "cursor-pointer hover:bg-[#1B1B1F]"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={alreadyAdded || isSelected}
                                    disabled={alreadyAdded || readOnly}
                                    onChange={() =>
                                      toggleCustomModelSelection(provider, model)
                                    }
                                    className="h-4 w-4 rounded border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium">{model.name}</span>
                                      {isFree ? (
                                        <Badge
                                          variant="outline"
                                          className="border-emerald-500/20 text-emerald-200 text-[10px]"
                                        >
                                          Free
                                        </Badge>
                                      ) : null}
                                      {alreadyAdded ? (
                                        <Badge variant="outline" className="text-[10px]">
                                          Already added
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className="truncate text-xs text-[#9B9B9F]">{model.id}</p>
                                  </div>
                                  {model.contextLength ? (
                                    <span className="shrink-0 text-xs text-[#9B9B9F]">
                                      {formatContextLength(model.contextLength)}
                                    </span>
                                  ) : null}
                                </label>
                              )
                            })}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAddSelectedCustomModels(provider)}
                            disabled={readOnly}
                            className="w-full rounded-xl"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Selected to Catalog
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {customProviderError ? (
              <p className="text-xs text-amber-200">{customProviderError}</p>
            ) : null}
          </div>

          <div className="border-t border-white/[0.04]" />

          {/* Manual add */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Custom Model</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  Model ID
                </Label>
                <Input
                  value={newModel.id}
                  onChange={(e) => setNewModel((c) => ({ ...c, id: e.target.value }))}
                  disabled={readOnly}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                  placeholder="openai/gpt-5-mini"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  Visible Name
                </Label>
                <Input
                  value={newModel.name}
                  onChange={(e) => setNewModel((c) => ({ ...c, name: e.target.value }))}
                  disabled={readOnly}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                  placeholder="GPT-5 Mini"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  Provider
                </Label>
                <Input
                  value={newModel.provider}
                  onChange={(e) => setNewModel((c) => ({ ...c, provider: e.target.value }))}
                  disabled={readOnly}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                  placeholder="OpenAI"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  Context Window
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={newModel.contextLength}
                  onChange={(e) => setNewModel((c) => ({ ...c, contextLength: e.target.value }))}
                  disabled={readOnly}
                  className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                  placeholder="128000"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">
                  Description
                </Label>
                <Textarea
                  value={newModel.description}
                  onChange={(e) => setNewModel((c) => ({ ...c, description: e.target.value }))}
                  disabled={readOnly}
                  className="min-h-20 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                  placeholder="Short description shown in the selector"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModel.enabled}
                  disabled={readOnly}
                  onChange={(e) => setNewModel((c) => ({ ...c, enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                />
                Enabled on save
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModel.makeDefault}
                  disabled={readOnly}
                  onChange={(e) => setNewModel((c) => ({ ...c, makeDefault: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                />
                Make default
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModel.supportsReasoning}
                  disabled={readOnly}
                  onChange={(e) => setNewModel((c) => ({ ...c, supportsReasoning: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                />
                Reasoning
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModel.isFast}
                  disabled={readOnly}
                  onChange={(e) => setNewModel((c) => ({ ...c, isFast: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                />
                Fast
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModel.isNewModel}
                  disabled={readOnly}
                  onChange={(e) => setNewModel((c) => ({ ...c, isNewModel: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
                />
                New badge
              </label>
            </div>

            <Button
              type="button"
              onClick={handleAddManualModel}
              disabled={readOnly}
              className="w-full rounded-xl"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add to Catalog
            </Button>

            {error ? <p className="text-xs text-amber-200">{error}</p> : null}
          </div>

          <div className="border-t border-white/[0.04]" />

          {/* PxRoute presets */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">PxRoute Presets</h3>
            <p className="text-xs text-[#9B9B9F]">
              Add the MidRelay-backed PxRoute models with the configured provider tag.
            </p>

            <div className="grid gap-2">
              {PXROUTE_PRESET_MODELS.map((model) => {
                const alreadyAdded = existingModelIds.has(model.id)

                return (
                  <div
                    key={model.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{model.name}</span>
                        <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-sky-200">
                          PxRoute
                        </Badge>
                        {model.isFast ? <Badge variant="outline">Fast</Badge> : null}
                        {alreadyAdded ? <Badge variant="outline">Already added</Badge> : null}
                      </div>
                      <p className="truncate text-xs text-[#9B9B9F]">{model.id}</p>
                      <p className="text-xs text-[#9B9B9F]">{model.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <Button
              type="button"
              onClick={handleAddPxRoutePresets}
              disabled={readOnly}
              className="w-full rounded-xl"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add PxRoute Presets
            </Button>
          </div>

          <div className="border-t border-border" />

          {/* OpenRouter import */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Import from OpenRouter</h3>
            <p className="text-xs text-[#9B9B9F]">
              Search, filter, and batch add OpenRouter models.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Popover open={isOpenRouterPopoverOpen} onOpenChange={setIsOpenRouterPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={readOnly}
                    className="rounded-xl"
                  >
                    {isLoadingOpenRouterModels ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronsUpDown className="mr-2 h-4 w-4" />
                    )}
                    Browse Models
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[40rem] max-w-[calc(100vw-2rem)] overflow-hidden overscroll-contain p-0"
                  onWheel={(event) => event.stopPropagation()}
                  onTouchMove={(event) => event.stopPropagation()}
                >
                  <Command className="flex max-h-[min(36rem,calc(100vh-6rem))] min-h-0 flex-col">
                    <CommandInput placeholder="Search by name, model ID, or provider" />
                    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                      {OPENROUTER_FILTERS.map((filterOption) => (
                        <Button
                          key={filterOption.value}
                          type="button"
                          size="sm"
                          variant={openRouterFilter === filterOption.value ? "secondary" : "ghost"}
                          onClick={() => setOpenRouterFilter(filterOption.value)}
                          className="rounded-lg"
                        >
                          {filterOption.label}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void loadOpenRouterModels(true)}
                        disabled={isLoadingOpenRouterModels}
                        className="ml-auto rounded-lg"
                      >
                        <RefreshCw
                          className={`h-4 w-4${isLoadingOpenRouterModels ? " animate-spin" : ""}`}
                        />
                        Refresh
                      </Button>
                    </div>
                    <CommandList
                      className="min-h-0 flex-1 max-h-none overscroll-contain"
                      onWheel={(event) => event.stopPropagation()}
                      onTouchMove={(event) => event.stopPropagation()}
                    >
                      <CommandEmpty>
                        {isLoadingOpenRouterModels
                          ? "Loading models..."
                          : "No models match the current search."}
                      </CommandEmpty>
                      <CommandGroup heading={`OpenRouter Models (${filteredOpenRouterModels.length})`}>
                        {filteredOpenRouterModels.map((model) => {
                          const alreadyAdded = existingModelIds.has(model.id)
                          const isSelected = selectedOpenRouterModelIdSet.has(model.id)

                          return (
                            <CommandItem
                              key={model.id}
                              value={`${model.name} ${model.id} ${model.provider} ${model.description}`}
                              onSelect={() => toggleOpenRouterSelection(model.id)}
                              disabled={alreadyAdded || readOnly}
                              className="items-start gap-3 px-3 py-3"
                            >
                              <Checkbox
                                checked={alreadyAdded || isSelected}
                                disabled
                                className="pointer-events-none mt-1"
                              />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{model.name}</span>
                                  {model.supportsReasoning ? (
                                    <Badge variant="outline">Reasoning</Badge>
                                  ) : null}
                                  {model.isFast ? (
                                    <Badge variant="outline">Fast</Badge>
                                  ) : null}
                                  {model.isFree ? (
                                    <Badge
                                      variant="outline"
                                      className="border-emerald-500/20 text-emerald-200"
                                    >
                                      Free
                                    </Badge>
                                  ) : null}
                                  {alreadyAdded ? (
                                    <Badge variant="outline">Already added</Badge>
                                  ) : null}
                                </div>
                                <p className="text-xs text-[#9B9B9F]">{model.id}</p>
                                <p className="text-xs text-[#9B9B9F]">
                                  {model.provider} · {formatContextLength(model.contextLength)} context
                                </p>
                                {model.description ? (
                                  <p className="line-clamp-2 text-xs text-[#9B9B9F]">
                                    {model.description}
                                  </p>
                                ) : null}
                              </div>
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Button
                type="button"
                onClick={handleAddSelectedOpenRouterModels}
                disabled={readOnly || selectedOpenRouterModelIds.length === 0}
                className="rounded-xl"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Selected ({selectedOpenRouterModelIds.length})
              </Button>
            </div>

            {selectedOpenRouterModels.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {selectedOpenRouterModels.slice(0, 4).map((model) => (
                  <Badge key={model.id} variant="outline">
                    {model.name}
                  </Badge>
                ))}
                {selectedOpenRouterModels.length > 4 ? (
                  <Badge variant="outline">+{selectedOpenRouterModels.length - 4} more</Badge>
                ) : null}
              </div>
            ) : null}

            {openRouterError ? <p className="text-xs text-amber-200">{openRouterError}</p> : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
