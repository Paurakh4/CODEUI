"use client"

import { Fragment, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { AddModelSheet } from "@/components/admin/add-model-sheet"
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

function mapInitialModels(models: AdminModelCatalogEntry[]): EditableModel[] {
  return models.map((model) => ({
    ...model,
    description: model.description ?? "",
  }))
}

function formatContextLength(contextLength: number) {
  if (contextLength >= 1000) return `${(contextLength / 1000).toFixed(0)}K`
  return String(contextLength)
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
    isNewModel: Boolean(model.isNewModel),
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
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAddModelSheetOpen, setIsAddModelSheetOpen] = useState(false)

  const initialSnapshot = useMemo(() => JSON.stringify(serializeModels(initialModels)), [initialModels])
  const currentSnapshot = useMemo(() => JSON.stringify(serializeModels(catalogModels)), [catalogModels])

  const enabledModelIds = useMemo(
    () => catalogModels.filter((model) => model.enabled).map((model) => model.id),
    [catalogModels],
  )
  const enabledModelSet = useMemo(() => new Set(enabledModelIds), [enabledModelIds])
  const catalogModelIdSet = useMemo(() => new Set(catalogModels.map((model) => model.id)), [catalogModels])

  const hasChanges = useMemo(
    () => currentSnapshot !== initialSnapshot || defaultModelId !== selectedDefaultModelId,
    [currentSnapshot, defaultModelId, initialSnapshot, selectedDefaultModelId],
  )

  const defaultModelName = useMemo(
    () => catalogModels.find((m) => m.id === selectedDefaultModelId)?.name ?? selectedDefaultModelId,
    [catalogModels, selectedDefaultModelId],
  )

  function updateModel(modelId: string, patch: Partial<EditableModel>) {
    setCatalogModels((current) =>
      current.map((model) => (model.id === modelId ? { ...model, ...patch } : model)),
    )
  }

  function handleToggleEnabled(modelId: string) {
    if (readOnly || isSaving) return
    setCatalogModels((current) => {
      const model = current.find((m) => m.id === modelId)
      if (!model) return current
      const wouldBeEnabled = !model.enabled

      if (!wouldBeEnabled && enabledModelIds.length === 1) {
        setError("At least one model must remain enabled.")
        return current
      }

      setError(null)
      const next = current.map((m) =>
        m.id === modelId ? { ...m, enabled: wouldBeEnabled } : m,
      )

      if (!wouldBeEnabled && selectedDefaultModelId === modelId) {
        const nextDefault = next.find((m) => m.enabled)?.id
        if (nextDefault) setSelectedDefaultModelId(nextDefault)
      }

      return next
    })
  }

  function handleRemoveCustomModel(modelId: string) {
    if (readOnly || isSaving) return
    const modelToRemove = catalogModels.find((model) => model.id === modelId)
    if (!modelToRemove?.isCustom) return

    const enabledCount = catalogModels.filter((model) => model.enabled).length
    if (modelToRemove.enabled && enabledCount === 1) {
      setError("At least one model must remain enabled.")
      return
    }

    const nextModels = catalogModels.filter((model) => model.id !== modelId)
    setCatalogModels(nextModels)

    if (selectedDefaultModelId === modelId) {
      const nextDefaultModelId = nextModels.find((model) => model.enabled)?.id
      if (nextDefaultModelId) setSelectedDefaultModelId(nextDefaultModelId)
    }

    if (expandedModelId === modelId) setExpandedModelId(null)
    setError(null)
  }

  function handleAddModels(newModels: EditableModel[], makeDefaultId?: string) {
    setCatalogModels((current) => [...current, ...newModels])
    if (makeDefaultId) {
      setSelectedDefaultModelId(makeDefaultId)
    } else if (newModels.some((m) => m.enabled) && enabledModelIds.length === 0) {
      const firstEnabled = newModels.find((m) => m.enabled)
      if (firstEnabled) setSelectedDefaultModelId(firstEnabled.id)
    }
    setIsAddModelSheetOpen(false)
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (readOnly) return
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          models: catalogModels.map((model) => ({
            id: model.id.trim(),
            name: model.name.trim(),
            provider: model.provider.trim(),
            description: model.description.trim(),
            contextLength: model.contextLength,
            supportsReasoning: Boolean(model.supportsReasoning),
            isFast: Boolean(model.isFast),
            isNewModel: Boolean(model.isNewModel),
          })),
          enabledModelIds,
          defaultModelId: selectedDefaultModelId,
          reason: reason.trim(),
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to update model policy")

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
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          {readOnlyReason}
        </div>
      ) : null}

      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {catalogModels.length} model{catalogModels.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {enabledModelIds.length} enabled · Default: {defaultModelName}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setIsAddModelSheetOpen(true)}
          disabled={readOnly || isSaving}
          className="rounded-xl"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Model
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Default</TableHead>
              <TableHead className="w-16">Active</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="hidden md:table-cell">Provider</TableHead>
              <TableHead className="hidden w-20 md:table-cell">Context</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalogModels.map((model) => {
              const isEnabled = enabledModelSet.has(model.id)
              const isExpanded = expandedModelId === model.id
              const isLastEnabled = isEnabled && enabledModelIds.length === 1

              return (
                <Fragment key={model.id}>
                  <TableRow className={isExpanded ? "bg-muted/30" : undefined}>
                    <TableCell>
                      <input
                        type="radio"
                        name="defaultModel"
                        value={model.id}
                        checked={selectedDefaultModelId === model.id}
                        onChange={() => setSelectedDefaultModelId(model.id)}
                        disabled={!isEnabled || readOnly || isSaving}
                        className="h-4 w-4 border-border text-primary accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => handleToggleEnabled(model.id)}
                        disabled={readOnly || isSaving || isLastEnabled}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {model.provider}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatContextLength(model.contextLength)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {model.supportsReasoning ? (
                          <Badge variant="outline" className="text-[10px]">
                            Reasoning
                          </Badge>
                        ) : null}
                        {model.isFast ? (
                          <Badge variant="outline" className="text-[10px]">
                            Fast
                          </Badge>
                        ) : null}
                        {model.isNewModel ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/20 text-emerald-200 text-[10px]"
                          >
                            New
                          </Badge>
                        ) : null}
                        {model.envEnabled ? (
                          <Badge variant="outline" className="text-[10px]">
                            Env
                          </Badge>
                        ) : null}
                        {model.isCustom ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200 text-[10px]"
                          >
                            Custom
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setExpandedModelId(isExpanded ? null : model.id)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        {model.isCustom ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomModel(model.id)}
                            disabled={readOnly || isSaving}
                            className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/20 p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              Visible Name
                            </Label>
                            <Input
                              value={model.name}
                              onChange={(e) => updateModel(model.id, { name: e.target.value })}
                              disabled={readOnly || isSaving}
                              className="h-10 rounded-xl"
                            />
                          </div>
                          {model.isCustom ? (
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Provider
                              </Label>
                              <Input
                                value={model.provider}
                                onChange={(e) =>
                                  updateModel(model.id, { provider: e.target.value })
                                }
                                disabled={readOnly || isSaving}
                                className="h-10 rounded-xl"
                              />
                            </div>
                          ) : null}
                          {model.isCustom ? (
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Context Window
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                value={model.contextLength > 0 ? String(model.contextLength) : ""}
                                onChange={(e) =>
                                  updateModel(model.id, {
                                    contextLength: Number.parseInt(e.target.value, 10) || 0,
                                  })
                                }
                                disabled={readOnly || isSaving}
                                className="h-10 rounded-xl"
                              />
                            </div>
                          ) : null}
                          {model.isCustom ? (
                            <div className="space-y-2 md:col-span-2">
                              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Description
                              </Label>
                              <Textarea
                                value={model.description}
                                onChange={(e) =>
                                  updateModel(model.id, { description: e.target.value })
                                }
                                disabled={readOnly || isSaving}
                                className="min-h-20 rounded-xl"
                              />
                            </div>
                          ) : model.description ? (
                            <div className="space-y-2 md:col-span-2">
                              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Description
                              </Label>
                              <p className="text-sm text-muted-foreground">{model.description}</p>
                            </div>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-4 md:col-span-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={Boolean(model.supportsReasoning)}
                                disabled={readOnly || isSaving}
                                onChange={(e) =>
                                  updateModel(model.id, {
                                    supportsReasoning: e.target.checked,
                                  })
                                }
                                className="h-4 w-4 rounded border-border bg-background text-primary"
                              />
                              Reasoning
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={Boolean(model.isFast)}
                                disabled={readOnly || isSaving}
                                onChange={(e) =>
                                  updateModel(model.id, { isFast: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-border bg-background text-primary"
                              />
                              Fast
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={Boolean(model.isNewModel)}
                                disabled={readOnly || isSaving}
                                onChange={(e) =>
                                  updateModel(model.id, { isNewModel: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-border bg-background text-primary"
                              />
                              New badge
                            </label>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Audit Reason */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Audit Reason
        </Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={readOnly || isSaving}
          className="h-10 rounded-xl"
          placeholder="Why are you changing the model catalog?"
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          {error}
        </div>
      ) : null}

      {/* Save */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Enabled models drive the public model API, AI route validation, and authenticated user
          defaults.
        </p>
        <Button
          type="submit"
          disabled={readOnly || isSaving || !hasChanges}
          className="rounded-xl"
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Model Policy
        </Button>
      </div>

      {/* Add model sheet */}
      <AddModelSheet
        open={isAddModelSheetOpen}
        onOpenChange={setIsAddModelSheetOpen}
        existingModelIds={catalogModelIdSet}
        onAddModels={handleAddModels}
        readOnly={readOnly}
      />
    </form>
  )
}
