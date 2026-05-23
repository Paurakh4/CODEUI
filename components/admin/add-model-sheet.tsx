"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronsUpDown, Loader2, Plus, RefreshCw } from "lucide-react"
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

interface EditableModel {
  id: string
  name: string
  provider: string
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
  description: string
  contextLength: number
  supportsReasoning: boolean
  isFast: boolean
  isNewModel: boolean
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

  function handleAddManualModel() {
    const id = newModel.id.trim()
    const name = newModel.name.trim()
    const provider = newModel.provider.trim()
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
            Add a custom model manually or import from OpenRouter.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6">
          {/* Manual add */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Custom Model</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Model ID
                </Label>
                <Input
                  value={newModel.id}
                  onChange={(e) => setNewModel((c) => ({ ...c, id: e.target.value }))}
                  disabled={readOnly}
                  className="h-10 rounded-xl"
                  placeholder="openai/gpt-5-mini"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Visible Name
                </Label>
                <Input
                  value={newModel.name}
                  onChange={(e) => setNewModel((c) => ({ ...c, name: e.target.value }))}
                  disabled={readOnly}
                  className="h-10 rounded-xl"
                  placeholder="GPT-5 Mini"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Provider
                </Label>
                <Input
                  value={newModel.provider}
                  onChange={(e) => setNewModel((c) => ({ ...c, provider: e.target.value }))}
                  disabled={readOnly}
                  className="h-10 rounded-xl"
                  placeholder="OpenAI"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Context Window
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={newModel.contextLength}
                  onChange={(e) => setNewModel((c) => ({ ...c, contextLength: e.target.value }))}
                  disabled={readOnly}
                  className="h-10 rounded-xl"
                  placeholder="128000"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  value={newModel.description}
                  onChange={(e) => setNewModel((c) => ({ ...c, description: e.target.value }))}
                  disabled={readOnly}
                  className="min-h-20 rounded-xl"
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
                  className="h-4 w-4 rounded border-border bg-background text-primary"
                />
                Enabled on save
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModel.makeDefault}
                  disabled={readOnly}
                  onChange={(e) => setNewModel((c) => ({ ...c, makeDefault: e.target.checked }))}
                  className="h-4 w-4 rounded border-border bg-background text-primary"
                />
                Make default
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModel.supportsReasoning}
                  disabled={readOnly}
                  onChange={(e) => setNewModel((c) => ({ ...c, supportsReasoning: e.target.checked }))}
                  className="h-4 w-4 rounded border-border bg-background text-primary"
                />
                Reasoning
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModel.isFast}
                  disabled={readOnly}
                  onChange={(e) => setNewModel((c) => ({ ...c, isFast: e.target.checked }))}
                  className="h-4 w-4 rounded border-border bg-background text-primary"
                />
                Fast
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModel.isNewModel}
                  disabled={readOnly}
                  onChange={(e) => setNewModel((c) => ({ ...c, isNewModel: e.target.checked }))}
                  className="h-4 w-4 rounded border-border bg-background text-primary"
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

          <div className="border-t border-border" />

          {/* OpenRouter import */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Import from OpenRouter</h3>
            <p className="text-xs text-muted-foreground">
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
                                <p className="text-xs text-muted-foreground">{model.id}</p>
                                <p className="text-xs text-muted-foreground">
                                  {model.provider} · {formatContextLength(model.contextLength)} context
                                </p>
                                {model.description ? (
                                  <p className="line-clamp-2 text-xs text-muted-foreground">
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
