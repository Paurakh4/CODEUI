"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import type { AdminModelCatalogEntry } from "@/lib/admin/model-policies"

interface ModelPolicyFormProps {
  models: AdminModelCatalogEntry[]
  defaultModelId: string
  readOnly?: boolean
  readOnlyReason?: string
}

type EditableModel = Omit<AdminModelCatalogEntry, "description" | "isDefault"> & {
  description: string
}

interface NewModelDraft {
  id: string
  name: string
  provider: string
  description: string
  contextLength: string
  supportsReasoning: boolean
  isFast: boolean
  isNew: boolean
  enabled: boolean
  makeDefault: boolean
}

interface OpenRouterModelOption {
  id: string
  name: string
  provider: string
  description: string
  contextLength: number
  supportsReasoning: boolean
  isFast: boolean
  isNew: boolean
  isFree: boolean
}

type OpenRouterFilter = "all" | "reasoning" | "fast" | "free"

const OPENROUTER_FILTERS: Array<{ value: OpenRouterFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "reasoning", label: "Reasoning" },
  { value: "fast", label: "Fast" },
  { value: "free", label: "Free" },
]

function createEmptyNewModel(): NewModelDraft {
  return {
    id: "",
    name: "",
    provider: "",
    description: "",
    contextLength: "128000",
    supportsReasoning: false,
    isFast: false,
    isNew: false,
    enabled: true,
    makeDefault: false,
  }
}

function mapInitialModels(models: AdminModelCatalogEntry[]): EditableModel[] {
  return models.map((model) => ({
    ...model,
    description: model.description ?? "",
  }))
}

function formatContextLength(contextLength: number) {
  if (contextLength >= 1000) {
    return `${(contextLength / 1000).toFixed(0)}K`
  }

  return String(contextLength)
}

function toEditableModel(model: OpenRouterModelOption): EditableModel {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    description: model.description,
    contextLength: model.contextLength,
    supportsReasoning: model.supportsReasoning,
    isFast: model.isFast,
    isNew: model.isNew,
    enabled: true,
    envEnabled: false,
    isCustom: true,
  }
}

function serializeModels(models: EditableModel[]) {
  return models.map((model) => ({
    id: model.id.trim(),
    name: model.name.trim(),
    provider: model.provider.trim(),
    description: model.description.trim(),
    contextLength: model.contextLength,
    supportsReasoning: Boolean(model.supportsReasoning),
    isFast: Boolean(model.isFast),
    isNew: Boolean(model.isNew),
    enabled: Boolean(model.enabled),
  }))
}

export function ModelPolicyForm({
  models,
  defaultModelId,
  readOnly = false,
  readOnlyReason,
}: ModelPolicyFormProps) {
  const router = useRouter()
  const initialModels = useMemo(() => mapInitialModels(models), [models])
  const [catalogModels, setCatalogModels] = useState<EditableModel[]>(initialModels)
  const [selectedDefaultModelId, setSelectedDefaultModelId] = useState(defaultModelId)
  const [newModel, setNewModel] = useState<NewModelDraft>(() => createEmptyNewModel())
  const [isOpenRouterPopoverOpen, setIsOpenRouterPopoverOpen] = useState(false)
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModelOption[]>([])
  const [selectedOpenRouterModelIds, setSelectedOpenRouterModelIds] = useState<string[]>([])
  const [openRouterFilter, setOpenRouterFilter] = useState<OpenRouterFilter>("all")
  const [isLoadingOpenRouterModels, setIsLoadingOpenRouterModels] = useState(false)
  const [openRouterError, setOpenRouterError] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initialSnapshot = useMemo(() => JSON.stringify(serializeModels(initialModels)), [initialModels])
  const currentSnapshot = useMemo(() => JSON.stringify(serializeModels(catalogModels)), [catalogModels])
  const enabledModelIds = useMemo(
    () => catalogModels.filter((model) => model.enabled).map((model) => model.id),
    [catalogModels],
  )
  const enabledModelSet = useMemo(() => new Set(enabledModelIds), [enabledModelIds])
  const catalogModelIdSet = useMemo(() => new Set(catalogModels.map((model) => model.id)), [catalogModels])
  const selectedOpenRouterModelIdSet = useMemo(
    () => new Set(selectedOpenRouterModelIds),
    [selectedOpenRouterModelIds],
  )
  const availableDefaultOptions = useMemo(
    () => catalogModels.filter((model) => enabledModelSet.has(model.id)),
    [catalogModels, enabledModelSet],
  )
  const filteredOpenRouterModels = useMemo(() => {
    return openRouterModels.filter((model) => {
      if (openRouterFilter === "reasoning") {
        return model.supportsReasoning
      }

      if (openRouterFilter === "fast") {
        return model.isFast
      }

      if (openRouterFilter === "free") {
        return model.isFree
      }

      return true
    })
  }, [openRouterFilter, openRouterModels])
  const selectedOpenRouterModels = useMemo(
    () => openRouterModels.filter((model) => selectedOpenRouterModelIdSet.has(model.id)),
    [openRouterModels, selectedOpenRouterModelIdSet],
  )
  const hasChanges = useMemo(
    () => currentSnapshot !== initialSnapshot || defaultModelId !== selectedDefaultModelId,
    [currentSnapshot, defaultModelId, initialSnapshot, selectedDefaultModelId],
  )

  async function loadOpenRouterModels(force = false) {
    if (isLoadingOpenRouterModels) {
      return
    }

    if (!force && openRouterModels.length > 0) {
      return
    }

    try {
      setIsLoadingOpenRouterModels(true)
      setOpenRouterError(null)

      const response = await fetch("/api/admin/models/openrouter", {
        method: "GET",
        cache: "no-store",
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load OpenRouter models")
      }

      const loadedModels = Array.isArray(data?.models) ? (data.models as OpenRouterModelOption[]) : []
      setOpenRouterModels(loadedModels)
      setSelectedOpenRouterModelIds((current) =>
        current.filter((modelId) => loadedModels.some((model) => model.id === modelId)),
      )
    } catch (loadError) {
      setOpenRouterError(
        loadError instanceof Error ? loadError.message : "Failed to load OpenRouter models",
      )
    } finally {
      setIsLoadingOpenRouterModels(false)
    }
  }

  useEffect(() => {
    if (isOpenRouterPopoverOpen && openRouterModels.length === 0 && !isLoadingOpenRouterModels) {
      void loadOpenRouterModels()
    }
  }, [isLoadingOpenRouterModels, isOpenRouterPopoverOpen, openRouterModels.length])

  const updateModel = (modelId: string, patch: Partial<EditableModel>) => {
    setCatalogModels((current) =>
      current.map((model) => (model.id === modelId ? { ...model, ...patch } : model)),
    )
  }

  const toggleModel = (modelId: string) => {
    setCatalogModels((current) => {
      const next = current.map((model) =>
        model.id === modelId ? { ...model, enabled: !model.enabled } : model,
      )
      const nextEnabledIds = next.filter((model) => model.enabled).map((model) => model.id)

      if (nextEnabledIds.length === 0) {
        return current
      }

      if (!nextEnabledIds.includes(selectedDefaultModelId)) {
        setSelectedDefaultModelId(nextEnabledIds[0])
      }

      return next
    })
    setError(null)
  }

  const removeCustomModel = (modelId: string) => {
    const modelToRemove = catalogModels.find((model) => model.id === modelId)
    if (!modelToRemove?.isCustom) {
      return
    }

    const enabledCount = catalogModels.filter((model) => model.enabled).length
    if (modelToRemove.enabled && enabledCount === 1) {
      setError("At least one model must remain enabled.")
      return
    }

    const nextModels = catalogModels.filter((model) => model.id !== modelId)
    setCatalogModels(nextModels)

    if (selectedDefaultModelId === modelId) {
      const nextDefaultModelId = nextModels.find((model) => model.enabled)?.id
      if (nextDefaultModelId) {
        setSelectedDefaultModelId(nextDefaultModelId)
      }
    }

    setError(null)
  }

  const handleAddModel = () => {
    if (readOnly) {
      return
    }

    const id = newModel.id.trim()
    const name = newModel.name.trim()
    const provider = newModel.provider.trim()
    const description = newModel.description.trim()
    const contextLength = Number.parseInt(newModel.contextLength, 10)

    if (!id || !name || !provider || !Number.isFinite(contextLength) || contextLength <= 0) {
      setError("Provide a model ID, visible name, provider, and a valid positive context window.")
      return
    }

    if (catalogModels.some((model) => model.id === id)) {
      setError("A model with that ID already exists in the catalog.")
      return
    }

    if (!newModel.enabled && newModel.makeDefault) {
      setError("A default model must be enabled.")
      return
    }

    const nextModel: EditableModel = {
      id,
      name,
      provider,
      description,
      contextLength,
      supportsReasoning: newModel.supportsReasoning,
      isFast: newModel.isFast,
      isNew: newModel.isNew,
      enabled: newModel.enabled,
      envEnabled: false,
      isCustom: true,
    }

    setCatalogModels((current) => [...current, nextModel])
    if (newModel.enabled && (newModel.makeDefault || enabledModelIds.length === 0)) {
      setSelectedDefaultModelId(id)
    }
    setNewModel(createEmptyNewModel())
    setError(null)
  }

  const toggleOpenRouterSelection = (modelId: string) => {
    if (catalogModelIdSet.has(modelId)) {
      return
    }

    setSelectedOpenRouterModelIds((current) =>
      current.includes(modelId)
        ? current.filter((candidateId) => candidateId !== modelId)
        : [...current, modelId],
    )
    setOpenRouterError(null)
  }

  const handleAddSelectedOpenRouterModels = () => {
    if (readOnly) {
      return
    }

    if (selectedOpenRouterModelIds.length === 0) {
      setOpenRouterError("Select at least one OpenRouter model first.")
      return
    }

    const modelsToAdd = openRouterModels
      .filter((model) => selectedOpenRouterModelIdSet.has(model.id))
      .filter((model) => !catalogModelIdSet.has(model.id))

    if (modelsToAdd.length === 0) {
      setOpenRouterError("Selected OpenRouter models are already in the catalog.")
      return
    }

    setCatalogModels((current) => [...current, ...modelsToAdd.map(toEditableModel)])
    setSelectedOpenRouterModelIds([])
    setIsOpenRouterPopoverOpen(false)
    setOpenRouterError(null)
    setError(null)
  }

  const invalidModel = catalogModels.find(
    (model) =>
      model.id.trim().length === 0 ||
      model.name.trim().length === 0 ||
      model.provider.trim().length === 0 ||
      !Number.isFinite(model.contextLength) ||
      model.contextLength <= 0,
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (readOnly) {
      return
    }

    if (!hasChanges) {
      setError("Adjust the model catalog or default model first.")
      return
    }

    if (invalidModel) {
      setError(`Complete the model details for ${invalidModel.id || "the unfinished model"} before saving.`)
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
          models: catalogModels.map((model) => ({
            id: model.id.trim(),
            name: model.name.trim(),
            provider: model.provider.trim(),
            description: model.description.trim(),
            contextLength: model.contextLength,
            supportsReasoning: Boolean(model.supportsReasoning),
            isFast: Boolean(model.isFast),
            isNew: Boolean(model.isNew),
          })),
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
      setNewModel(createEmptyNewModel())
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
        <div className="rounded-2xl border border-dashed border-[#0AA6FF]/30 bg-[#0B0C0D] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Add custom model</p>
              <p className="mt-1 text-xs text-[#A6A6A6]">
                Add a model here instead of editing source files. Visible name controls what users see in the selector.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleAddModel}
              disabled={readOnly || isSaving}
              className="rounded-xl bg-[#0AA6FF] text-white hover:bg-[#0AA6FF]/90"
            >
              <Plus className="h-4 w-4" />
              Add Model
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2 xl:col-span-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Import from OpenRouter</p>
                    <p className="mt-1 text-xs text-[#A6A6A6]">
                      Search, filter, and batch add OpenRouter models without typing IDs manually.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Popover open={isOpenRouterPopoverOpen} onOpenChange={setIsOpenRouterPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={readOnly || isSaving}
                          className="rounded-xl border-white/10 bg-[#050607] text-white hover:bg-white/5"
                        >
                          {isLoadingOpenRouterModels ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ChevronsUpDown className="h-4 w-4" />
                          )}
                          Browse Models
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-[40rem] max-w-[calc(100vw-2rem)] border-white/10 bg-[#050607] p-0 text-white"
                      >
                        <Command className="bg-[#050607] text-white">
                          <CommandInput placeholder="Search by name, model ID, or provider" />

                          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
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

                          <CommandList className="max-h-[22rem]">
                            <CommandEmpty>
                              {isLoadingOpenRouterModels ? "Loading models..." : "No models match the current search."}
                            </CommandEmpty>
                            <CommandGroup heading={`OpenRouter Models (${filteredOpenRouterModels.length})`}>
                              {filteredOpenRouterModels.map((model) => {
                                const alreadyAdded = catalogModelIdSet.has(model.id)
                                const isSelected = selectedOpenRouterModelIdSet.has(model.id)

                                return (
                                  <CommandItem
                                    key={model.id}
                                    value={`${model.name} ${model.id} ${model.provider} ${model.description}`}
                                    onSelect={() => toggleOpenRouterSelection(model.id)}
                                    disabled={alreadyAdded || readOnly || isSaving}
                                    className="items-start gap-3 px-3 py-3"
                                  >
                                    <Checkbox
                                      checked={alreadyAdded || isSelected}
                                      disabled
                                      className="pointer-events-none mt-1"
                                    />

                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-white">{model.name}</span>
                                        {model.supportsReasoning ? (
                                          <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
                                            Reasoning
                                          </Badge>
                                        ) : null}
                                        {model.isFast ? (
                                          <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
                                            Fast
                                          </Badge>
                                        ) : null}
                                        {model.isFree ? (
                                          <Badge variant="outline" className="border-emerald-500/20 text-emerald-200">
                                            Free
                                          </Badge>
                                        ) : null}
                                        {alreadyAdded ? (
                                          <Badge variant="outline" className="border-[#0AA6FF]/20 text-[#7FD0FF]">
                                            Already added
                                          </Badge>
                                        ) : null}
                                      </div>

                                      <p className="text-xs text-[#A6A6A6]">{model.id}</p>
                                      <p className="text-xs text-[#7D8388]">
                                        {model.provider} · {formatContextLength(model.contextLength)} context
                                      </p>
                                      {model.description ? (
                                        <p className="line-clamp-2 text-xs text-[#D6D8DA]">{model.description}</p>
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
                      disabled={readOnly || isSaving || selectedOpenRouterModelIds.length === 0}
                      className="rounded-xl bg-[#0AA6FF] text-white hover:bg-[#0AA6FF]/90"
                    >
                      <Plus className="h-4 w-4" />
                      Add Selected
                    </Button>
                  </div>
                </div>

                {selectedOpenRouterModels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {selectedOpenRouterModels.slice(0, 4).map((model) => (
                      <Badge key={model.id} variant="outline" className="border-white/10 text-[#D6D8DA]">
                        {model.name}
                      </Badge>
                    ))}
                    {selectedOpenRouterModels.length > 4 ? (
                      <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
                        +{selectedOpenRouterModels.length - 4} more
                      </Badge>
                    ) : null}
                  </div>
                ) : null}

                {openRouterError ? (
                  <p className="mt-3 text-xs text-amber-200">{openRouterError}</p>
                ) : null}
              </div>
            </div>

            <label className="space-y-2 text-sm text-[#D6D8DA]">
              <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Model ID</span>
              <Input
                value={newModel.id}
                onChange={(event) => setNewModel((current) => ({ ...current, id: event.target.value }))}
                disabled={readOnly || isSaving}
                className="h-10 rounded-xl border-white/10 bg-[#050607] text-white"
                placeholder="openai/gpt-5-mini"
              />
            </label>
            <label className="space-y-2 text-sm text-[#D6D8DA]">
              <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Visible Name</span>
              <Input
                value={newModel.name}
                onChange={(event) => setNewModel((current) => ({ ...current, name: event.target.value }))}
                disabled={readOnly || isSaving}
                className="h-10 rounded-xl border-white/10 bg-[#050607] text-white"
                placeholder="GPT-5 Mini"
              />
            </label>
            <label className="space-y-2 text-sm text-[#D6D8DA]">
              <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Provider</span>
              <Input
                value={newModel.provider}
                onChange={(event) => setNewModel((current) => ({ ...current, provider: event.target.value }))}
                disabled={readOnly || isSaving}
                className="h-10 rounded-xl border-white/10 bg-[#050607] text-white"
                placeholder="OpenAI"
              />
            </label>
            <label className="space-y-2 text-sm text-[#D6D8DA]">
              <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Context Window</span>
              <Input
                type="number"
                min={1}
                step={1}
                value={newModel.contextLength}
                onChange={(event) =>
                  setNewModel((current) => ({ ...current, contextLength: event.target.value }))
                }
                disabled={readOnly || isSaving}
                className="h-10 rounded-xl border-white/10 bg-[#050607] text-white"
                placeholder="128000"
              />
            </label>
          </div>

          <label className="mt-3 block space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Description</span>
            <Textarea
              value={newModel.description}
              onChange={(event) => setNewModel((current) => ({ ...current, description: event.target.value }))}
              disabled={readOnly || isSaving}
              className="min-h-24 rounded-2xl border-white/10 bg-[#050607] text-white"
              placeholder="Short description shown in the selector"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#D6D8DA]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newModel.enabled}
                disabled={readOnly || isSaving}
                onChange={(event) => setNewModel((current) => ({ ...current, enabled: event.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-[#050607] text-[#0AA6FF]"
              />
              Enabled on save
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newModel.makeDefault}
                disabled={readOnly || isSaving}
                onChange={(event) =>
                  setNewModel((current) => ({ ...current, makeDefault: event.target.checked }))
                }
                className="h-4 w-4 rounded border-white/20 bg-[#050607] text-[#0AA6FF]"
              />
              Make default
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newModel.supportsReasoning}
                disabled={readOnly || isSaving}
                onChange={(event) =>
                  setNewModel((current) => ({ ...current, supportsReasoning: event.target.checked }))
                }
                className="h-4 w-4 rounded border-white/20 bg-[#050607] text-[#0AA6FF]"
              />
              Reasoning
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newModel.isFast}
                disabled={readOnly || isSaving}
                onChange={(event) => setNewModel((current) => ({ ...current, isFast: event.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-[#050607] text-[#0AA6FF]"
              />
              Fast
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newModel.isNew}
                disabled={readOnly || isSaving}
                onChange={(event) => setNewModel((current) => ({ ...current, isNew: event.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-[#050607] text-[#0AA6FF]"
              />
              New badge
            </label>
          </div>
        </div>

        {catalogModels.map((model) => {
          const isEnabled = enabledModelSet.has(model.id)

          return (
            <div
              key={model.id}
              className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4"
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  disabled={readOnly || isSaving || (isEnabled && enabledModelIds.length === 1)}
                  onChange={() => toggleModel(model.id)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-[#0B0C0D] text-[#0AA6FF]"
                />

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{model.id}</p>
                        {selectedDefaultModelId === model.id ? (
                          <span className="rounded-full border border-[#0AA6FF]/30 bg-[#0AA6FF]/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-[#7FD0FF]">
                            Current default
                          </span>
                        ) : null}
                        {model.envEnabled ? (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-[#A6A6A6]">
                            Env enabled
                          </span>
                        ) : null}
                        {model.isCustom ? (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-emerald-200">
                            Custom
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-[#7D8388]">
                        {model.provider} · {formatContextLength(model.contextLength)} context{model.supportsReasoning ? " · Reasoning" : ""}{model.isFast ? " · Fast" : ""}
                      </p>
                    </div>

                    {model.isCustom ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeCustomModel(model.id)}
                        disabled={readOnly || isSaving}
                        className="rounded-xl border-red-500/20 bg-red-500/5 text-red-200 hover:bg-red-500/10 hover:text-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-[#D6D8DA]">
                      <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Visible Name</span>
                      <Input
                        value={model.name}
                        onChange={(event) => updateModel(model.id, { name: event.target.value })}
                        disabled={readOnly || isSaving}
                        className="h-10 rounded-xl border-white/10 bg-[#0B0C0D] text-white"
                        placeholder="Visible name shown to users"
                      />
                    </label>

                    {model.isCustom ? (
                      <label className="space-y-2 text-sm text-[#D6D8DA]">
                        <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Provider</span>
                        <Input
                          value={model.provider}
                          onChange={(event) => updateModel(model.id, { provider: event.target.value })}
                          disabled={readOnly || isSaving}
                          className="h-10 rounded-xl border-white/10 bg-[#0B0C0D] text-white"
                        />
                      </label>
                    ) : null}
                  </div>

                  {model.isCustom ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-[#D6D8DA]">
                        <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Description</span>
                        <Textarea
                          value={model.description}
                          onChange={(event) => updateModel(model.id, { description: event.target.value })}
                          disabled={readOnly || isSaving}
                          className="min-h-24 rounded-2xl border-white/10 bg-[#0B0C0D] text-white"
                        />
                      </label>

                      <div className="space-y-3">
                        <label className="space-y-2 text-sm text-[#D6D8DA]">
                          <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Context Window</span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={model.contextLength > 0 ? String(model.contextLength) : ""}
                            onChange={(event) =>
                              updateModel(model.id, {
                                contextLength: Number.parseInt(event.target.value, 10) || 0,
                              })
                            }
                            disabled={readOnly || isSaving}
                            className="h-10 rounded-xl border-white/10 bg-[#0B0C0D] text-white"
                          />
                        </label>

                        <div className="flex flex-wrap gap-4 text-sm text-[#D6D8DA]">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(model.supportsReasoning)}
                              disabled={readOnly || isSaving}
                              onChange={(event) =>
                                updateModel(model.id, { supportsReasoning: event.target.checked })
                              }
                              className="h-4 w-4 rounded border-white/20 bg-[#0B0C0D] text-[#0AA6FF]"
                            />
                            Reasoning
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(model.isFast)}
                              disabled={readOnly || isSaving}
                              onChange={(event) => updateModel(model.id, { isFast: event.target.checked })}
                              className="h-4 w-4 rounded border-white/20 bg-[#0B0C0D] text-[#0AA6FF]"
                            />
                            Fast
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(model.isNew)}
                              disabled={readOnly || isSaving}
                              onChange={(event) => updateModel(model.id, { isNew: event.target.checked })}
                              className="h-4 w-4 rounded border-white/20 bg-[#0B0C0D] text-[#0AA6FF]"
                            />
                            New badge
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : model.description ? (
                    <p className="text-sm text-[#D6D8DA]">{model.description}</p>
                  ) : null}
                </div>
              </div>
            </div>
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
          placeholder="Why are you changing the model catalog?"
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[#A6A6A6]">
          Enabled models drive the public model API, AI route validation, and authenticated user defaults.
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