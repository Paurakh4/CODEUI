"use client"

import { useRef, useCallback, useState, useEffect, type ChangeEvent, type DragEvent } from "react"
import {
  ArrowUp,
  Plus,
  Sparkles,
  Loader2,
  Bot,
  Zap,
  ChevronDown,
  LayoutTemplate,
  Code,
  Paperclip,
  X,
  Key,
  Check,
  Gauge,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
  isVisionCapableModel,
  isByokModelId,
  ALL_MODELS,
  THINKING_EFFORT_OPTIONS,
  type ThinkingEffort,
} from "@/lib/ai-models"
import { ByokProviderSheet } from "@/components/byok/byok-provider-sheet"
import { cn } from "@/lib/utils"

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

// ponytail: image payload caps — large data URLs bloat Mongo docs; upgrade path = upload to media library + store URL
const MAX_IMAGES_PER_MESSAGE = 4
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const IMAGE_DOWNSCALE_MAX_DIM = 1024

interface AttachedImage {
  id: string
  dataUrl: string
  name: string
}

function generateImageId() {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function downscaleImage(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width <= maxDim && height <= maxDim) {
          resolve(reader.result as string)
          return
        }
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Failed to get canvas context"))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.onerror = () => reject(new Error("Failed to load image for downscale"))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

export interface PromptInputProps {
  // Prompt value — if provided, component is controlled
  promptValue?: string
  onPromptValueChange?: (value: string) => void

  // Send: always receives the message text
  onSend: (message: string, images?: Array<{ dataUrl: string }>) => void

  // Enhance: if returns string, component updates value; if void, parent updates controlled value
  onEnhance?: (message: string) => Promise<string | void>

  // Draft change — called on every text change (editor uses this for design discovery)
  onDraftChange?: (message: string) => void

  // Cancel generation (editor only)
  onCancel?: () => void
  isGenerating?: boolean

  // Queue (editor only)
  queuedPrompt?: string | null
  onCancelQueued?: () => void

  // Loading state (dashboard only — disables input while starting project)
  isStartingProject?: boolean

  // Model selection
  selectedModelId: string
  availableModels: { id: string; name: string }[]
  isLoadingModels: boolean
  getModelIcon: (modelId: string) => React.ReactNode
  onModelChange: (modelId: string) => void

  // Thinking effort
  thinkingEffort?: ThinkingEffort
  onThinkingEffortChange?: (effort: ThinkingEffort) => void

  // Quick actions (dashboard only)
  onStartLandingPage?: () => void
  onStartBlankProject?: () => void
  hasProjects?: boolean

  // Visual variant: "dashboard" (default) or "editor" to match surrounding borders
  variant?: "dashboard" | "editor"
}

export function PromptInput({
  promptValue,
  onPromptValueChange,
  onSend,
  onEnhance,
  onDraftChange,
  onCancel,
  isGenerating = false,
  queuedPrompt,
  onCancelQueued,
  isStartingProject = false,
  selectedModelId,
  availableModels,
  isLoadingModels,
  getModelIcon,
  onModelChange,
  thinkingEffort = "high",
  onThinkingEffortChange,
  onStartLandingPage,
  onStartBlankProject,
  hasProjects = false,
  variant = "dashboard",
}: PromptInputProps) {
  const [byokSheetOpen, setByokSheetOpen] = useState(false)
  const [internalValue, setInternalValue] = useState("")
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Controlled vs uncontrolled value
  const isControlled = promptValue !== undefined
  const value = isControlled ? promptValue! : internalValue

  const setValue = useCallback(
    (newValue: string) => {
      if (isControlled) {
        onPromptValueChange?.(newValue)
      } else {
        setInternalValue(newValue)
      }
      onDraftChange?.(newValue)
    },
    [isControlled, onPromptValueChange, onDraftChange],
  )

  const adjustHeight = useCallback((reset?: boolean) => {
    const textarea = textareaRef.current
    if (!textarea) return
    if (reset) {
      textarea.style.height = "56px"
      return
    }
    textarea.style.height = "56px"
    const newHeight = Math.max(56, Math.min(textarea.scrollHeight, 200))
    textarea.style.height = `${newHeight}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!isVisionCapableModel(selectedModelId)) return

      const imageFiles: File[] = []
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i]
        if (!file.type.startsWith("image/")) continue
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          console.warn(`Image "${file.name}" exceeds ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB limit, skipping`)
          continue
        }
        imageFiles.push(file)
      }

      const remaining = MAX_IMAGES_PER_MESSAGE - attachedImages.length
      const toAdd = imageFiles.slice(0, remaining)

      const newImages: AttachedImage[] = await Promise.all(
        toAdd.map(async (file) => ({
          id: generateImageId(),
          dataUrl: await downscaleImage(file, IMAGE_DOWNSCALE_MAX_DIM),
          name: file.name,
        })),
      )

      setAttachedImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES_PER_MESSAGE))

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [attachedImages.length, selectedModelId],
  )

  const removeImage = useCallback((id: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const handleContinueWriting = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    const caretPosition = textarea.value.length
    textarea.setSelectionRange(caretPosition, caretPosition)
    adjustHeight()
  }, [adjustHeight])

  const handleSubmit = useCallback(() => {
    if (isStartingProject) return
    const trimmed = value.trim()
    if (!trimmed && attachedImages.length === 0) return
    const images = attachedImages.map((img) => ({ dataUrl: img.dataUrl }))
    onSend(trimmed, images.length > 0 ? images : undefined)
    if (!isControlled) {
      setInternalValue("")
    }
    onPromptValueChange?.("")
    setAttachedImages([])
    adjustHeight(true)
  }, [value, isStartingProject, attachedImages, onSend, isControlled, onPromptValueChange, adjustHeight])

  const handleEnhance = useCallback(async () => {
    if (!onEnhance || !value.trim() || isEnhancing) return
    setIsEnhancing(true)
    try {
      const result = await onEnhance(value.trim())
      if (typeof result === "string" && result.trim()) {
        setValue(result.trim())
        window.requestAnimationFrame(() => adjustHeight())
      }
    } finally {
      setIsEnhancing(false)
    }
  }, [onEnhance, value, isEnhancing, setValue, adjustHeight])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!isStartingProject && !isEnhancing) {
        handleSubmit()
      }
    }
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        void addFiles(files)
      }
    },
    [addFiles],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingOver(false)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        void addFiles(e.dataTransfer.files)
      }
    },
    [addFiles],
  )

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        void addFiles(e.target.files)
      }
    },
    [addFiles],
  )

  const selectedModelName =
    availableModels.find((m) => m.id === selectedModelId)?.name || "Model"

  const canSubmit = value.trim().length > 0 || attachedImages.length > 0
  const busy = isStartingProject || isGenerating

  return (
    <div className={variant === "editor" ? "flex-1 flex flex-col w-full" : "flex-1 flex flex-col items-center justify-center w-full max-w-[680px] mx-auto px-3 sm:px-4 py-[7vh]"}>
      <div className={variant === "editor" ? "w-full relative" : "w-full max-w-[680px] space-y-1.5 relative"}>
        {/* Headline — dashboard only */}
        {variant !== "editor" && (
          <div className="flex flex-col gap-0">
            <span className="text-[11px] font-medium text-[#9B9B9F]/55">
              {getGreeting()}
            </span>
            <h1 className="text-[24px] sm:text-[34px] font-normal tracking-tight text-white text-glow leading-tight">
              {hasProjects ? "Continue building, or start something new." : "What do you want to create?"}
            </h1>
          </div>
        )}

        {/* Tactile Input Card */}
        <div
          className={`input-card ${variant === "editor" ? "!border-zinc-800/50" : ""} ${isDraggingOver ? "ring-1 ring-blue-500/50 bg-blue-500/[0.02]" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Image preview chips */}
          {attachedImages.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
              {attachedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative group rounded-md overflow-hidden border border-white/[0.08] bg-black/20"
                  style={{ width: 48, height: 48 }}
                >
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    aria-label={`Remove ${img.name}`}
                    className="absolute top-0 right-0 p-0.5 rounded-bl-md bg-black/60 text-white/80 hover:bg-black/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Queued prompt chip (editor only) */}
          {isGenerating && queuedPrompt ? (
            <div className="px-3 pb-1">
              <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md px-2 py-1 text-[11px] text-blue-400">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                <span className="truncate max-w-[200px]">Queued: {queuedPrompt}</span>
                <button
                  type="button"
                  onClick={onCancelQueued}
                  className="ml-1 p-0.5 rounded hover:bg-blue-500/20 transition-colors"
                  aria-label="Cancel queued prompt"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="w-full bg-transparent text-[#E7E7E9] text-[14px] font-[500] px-3 py-2.5 min-h-[44px] max-h-[200px] outline-none resize-none placeholder:text-[#7B7B80] leading-snug"
            placeholder={onEnhance ? "Describe what you'd like to change..." : "What can I do for you?"}
            rows={1}
          />

          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-0.5">
              {/* Enhance button */}
              {onEnhance && value.trim() ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleEnhance}
                      disabled={isEnhancing || busy}
                      aria-label="Enhance prompt"
                      className="flex items-center justify-center h-6 w-6 text-[#9B9B9F] hover:text-white hover:bg-[#1B1B1F] rounded-lg transition-colors"
                    >
                      {isEnhancing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-[#0E0E10] text-[#E7E7E9] border-white/[0.04] text-[11px]">
                    Improve this prompt
                  </TooltipContent>
                </Tooltip>
              ) : null}

              {/* Plus menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center h-6 w-6 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-52 bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]"
                >
                  <DropdownMenuItem
                    onSelect={handleContinueWriting}
                    className="cursor-pointer gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Continue writing prompt</span>
                  </DropdownMenuItem>
                  {onStartLandingPage ? (
                    <DropdownMenuItem
                      onSelect={onStartLandingPage}
                      className="cursor-pointer gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-xs"
                    >
                      <LayoutTemplate className="w-3.5 h-3.5" />
                      <span>Use landing page starter</span>
                    </DropdownMenuItem>
                  ) : null}
                  {onStartBlankProject ? (
                    <DropdownMenuItem
                      onSelect={onStartBlankProject}
                      className="cursor-pointer gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-xs"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Create blank project</span>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="h-3 w-px bg-white/[0.04]" />

              {/* File picker for images */}
              <label
                className={`flex items-center justify-center h-6 w-6 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg transition-colors ${(!isVisionCapableModel(selectedModelId) || busy) ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
                aria-label="Attach images"
                title={!isVisionCapableModel(selectedModelId) ? "This model doesn't support image input. Switch to a vision-capable model." : "Attach images"}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileInputChange}
                  accept="image/*"
                  multiple
                  disabled={busy || !isVisionCapableModel(selectedModelId)}
                />
                <Paperclip className="w-3 h-3" />
              </label>

              <div className="h-3 w-px bg-white/[0.04]" />

              {/* Model selector with thinking effort submenu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1 px-1.5 h-6 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg text-[10px] font-normal transition-colors opacity-90 hover:opacity-100"
                    disabled={isLoadingModels || busy}
                  >
                    {isLoadingModels ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[#9B9B9F]">{getModelIcon(selectedModelId)}</span>
                        <span className="text-[11px] font-[400] tracking-[0.02em]">{selectedModelName}</span>
                        {(() => {
                          const fullModel = ALL_MODELS.find((m) => m.id === selectedModelId)
                          if (fullModel?.supportsThinkingEffort && onThinkingEffortChange) {
                            return (
                              <span className="flex items-center gap-0.5 text-[9px] font-medium bg-purple-500/20 text-purple-300 px-1 py-0.5 rounded">
                                <Gauge className="w-2 h-2" />
                                {THINKING_EFFORT_OPTIONS.find((o) => o.value === thinkingEffort)?.label ?? "High"}
                              </span>
                            )
                          }
                          return null
                        })()}
                        <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-52 bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]"
                >
                  {availableModels.map((model) => {
                    const fullModel = ALL_MODELS.find((m) => m.id === model.id)
                    const supportsThinking = fullModel?.supportsThinkingEffort === true && Boolean(onThinkingEffortChange)

                    if (supportsThinking) {
                      return (
                        <DropdownMenuSub key={model.id}>
                          <DropdownMenuSubTrigger className="gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] cursor-pointer py-1.5 text-xs data-[state=open]:bg-[#1B1B1F]">
                            <span className="text-[#9B9B9F]">{getModelIcon(model.id)}</span>
                            <span>{model.name}</span>
                            {isByokModelId(model.id) && (
                              <span className="ml-auto text-[9px] font-medium bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                                BYOK
                              </span>
                            )}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-48 bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]">
                            <DropdownMenuLabel className="text-[#9B9B9F] text-[10px] flex items-center gap-1.5">
                              <Gauge className="w-2.5 h-2.5" />
                              Thinking Effort
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/[0.04]" />
                            {THINKING_EFFORT_OPTIONS.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onModelChange(model.id)
                                  onThinkingEffortChange!(option.value)
                                }}
                                className="gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] cursor-pointer py-1.5 text-xs"
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="text-[#E7E7E9]">{option.label}</span>
                                  <p className="text-[9px] text-[#6B6B70] mt-0.5">{option.description}</p>
                                </div>
                                {thinkingEffort === option.value && (
                                  <Check className="w-3 h-3 text-purple-400" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )
                    }

                    return (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => onModelChange(model.id)}
                        className="gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] cursor-pointer py-1.5 text-xs"
                      >
                        <span className="text-[#9B9B9F]">{getModelIcon(model.id)}</span>
                        <span>{model.name}</span>
                        {isByokModelId(model.id) && (
                          <span className="ml-auto text-[9px] font-medium bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                            BYOK
                          </span>
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator className="bg-white/[0.04]" />
                  <DropdownMenuItem
                    onClick={() => setByokSheetOpen(true)}
                    className="gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] cursor-pointer py-1.5 text-xs text-purple-300"
                  >
                    <Key className="w-3 h-3" />
                    <span>Add Provider</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Send / Cancel button */}
            <button
              onClick={() => {
                if (isGenerating) {
                  onCancel?.()
                  return
                }
                handleSubmit()
              }}
              disabled={(!isGenerating && !canSubmit && !isStartingProject) || isEnhancing}
              aria-label={isGenerating ? "Cancel generation" : "Send prompt"}
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded-lg transition-all focus-visible:outline-none",
                isGenerating
                  ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/15 dark:text-rose-300"
                  : "bg-[#121212] text-white hover:bg-[#1B1B1F] disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {isGenerating ? (
                <X className="w-3 h-3" />
              ) : isStartingProject ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Starts — only show if landing page starter is provided */}
        {onStartLandingPage ? (
          <div className="flex flex-col items-center gap-1.5 mt-0.5">
            <span className="text-[11px] font-medium text-[#6B6B70]">Start with</span>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                onClick={isStartingProject ? undefined : onStartLandingPage}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0E0E10] border border-white/[0.05] text-xs text-[#E7E7E9] hover:bg-[#1B1B1F] hover:border-white/[0.08] transition-all duration-150 ease-out hover:scale-[1.02] focus-visible:outline-none"
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                <span>Landing Page</span>
              </button>
              <button
                onClick={isStartingProject ? undefined : () => onSend("Create a modern dashboard with analytics charts, a sidebar, and data tables.")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0E0E10] border border-white/[0.05] text-xs text-[#E7E7E9] hover:bg-[#1B1B1F] hover:border-white/[0.08] transition-all duration-150 ease-out hover:scale-[1.02] focus-visible:outline-none"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={isStartingProject ? undefined : () => onSend("Create a portfolio website with a hero section, project showcase grid, and contact form.")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0E0E10] border border-white/[0.05] text-xs text-[#E7E7E9] hover:bg-[#1B1B1F] hover:border-white/[0.08] transition-all duration-150 ease-out hover:scale-[1.02] focus-visible:outline-none"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Portfolio</span>
              </button>
              <button
                onClick={isStartingProject ? undefined : () => onSend("Create a marketing site with a hero, feature highlights, pricing table, and FAQ section.")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0E0E10] border border-white/[0.05] text-xs text-[#E7E7E9] hover:bg-[#1B1B1F] hover:border-white/[0.08] transition-all duration-150 ease-out hover:scale-[1.02] focus-visible:outline-none"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Marketing</span>
              </button>
              <button
                onClick={isStartingProject ? undefined : () => onSend("Create a documentation site with a sidebar navigation, search bar, and content sections.")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0E0E10] border border-white/[0.05] text-xs text-[#E7E7E9] hover:bg-[#1B1B1F] hover:border-white/[0.08] transition-all duration-150 ease-out hover:scale-[1.02] focus-visible:outline-none"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Docs</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ByokProviderSheet
        open={byokSheetOpen}
        onOpenChange={setByokSheetOpen}
        onProvidersChanged={() => {
          window.dispatchEvent(new Event("byok-providers-changed"))
        }}
      />
    </div>
  )
}
