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
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { isVisionCapableModel, isByokModelId } from "@/lib/ai-models"
import { ByokProviderSheet } from "@/components/byok/byok-provider-sheet"

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

interface DashboardPromptAreaProps {
  promptValue: string
  onPromptValueChange: (value: string) => void
  onSend: (images?: Array<{ dataUrl: string }>) => void
  onEnhance: () => void
  isEnhancing: boolean
  isStartingProject?: boolean
  selectedModelId: string
  selectedModelName: string
  availableModels: { id: string; name: string }[]
  isLoadingModels: boolean
  getModelIcon: (modelId: string) => React.ReactNode
  onModelChange: (modelId: string) => void
  onStartLandingPage: () => void
  onStartBlankProject: () => void
}

export function DashboardPromptArea({
  promptValue,
  onPromptValueChange,
  onSend,
  onEnhance,
  isEnhancing,
  isStartingProject = false,
  selectedModelId,
  selectedModelName,
  availableModels,
  isLoadingModels,
  getModelIcon,
  onModelChange,
  onStartLandingPage,
  onStartBlankProject,
}: DashboardPromptAreaProps) {
  const [byokSheetOpen, setByokSheetOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const adjustHeight = useCallback((reset?: boolean) => {
    const textarea = textareaRef.current
    if (!textarea) return
    if (reset) {
      textarea.style.height = "44px"
      return
    }
    textarea.style.height = "44px"
    const newHeight = Math.max(44, Math.min(textarea.scrollHeight, 200))
    textarea.style.height = `${newHeight}px`
  }, [])

  // ponytail: external prompt changes (enhance, etc.) don't trigger onChange,
  // so we watch the prop and re-adjust.
  useEffect(() => {
    adjustHeight()
  }, [promptValue, adjustHeight])

  const addFiles = useCallback(async (files: FileList | File[]) => {
    if (!isVisionCapableModel(selectedModelId)) {
      return
    }

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
      }))
    )

    setAttachedImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES_PER_MESSAGE))

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [attachedImages.length, selectedModelId])

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!isStartingProject) {
        const images = attachedImages.map((img) => ({ dataUrl: img.dataUrl }))
        onSend(images.length > 0 ? images : undefined)
        setAttachedImages([])
      }
    }
  }

  const handleSubmit = () => {
    if (isStartingProject) return
    const images = attachedImages.map((img) => ({ dataUrl: img.dataUrl }))
    onSend(images.length > 0 ? images : undefined)
    setAttachedImages([])
  }

  // Paste handler
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
  }, [addFiles])

  // Drag-and-drop
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

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void addFiles(e.dataTransfer.files)
    }
  }, [addFiles])

  const handleFileInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void addFiles(e.target.files)
    }
  }, [addFiles])

  const canSubmit = promptValue.trim().length > 0 || attachedImages.length > 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-3 sm:px-4 pt-1 pb-2">
      <div className="w-full max-w-2xl space-y-3 relative">
        {/* Headline */}
        <div className="flex flex-col items-center">
          <h1 className="text-[22px] sm:text-[26px] font-bold text-center tracking-tight text-white text-glow leading-tight">
            What do you want to create?
          </h1>
        </div>

        {/* Tactile Input Card */}
        <div
          className={`input-card ${isDraggingOver ? "ring-1 ring-blue-500/50 bg-blue-500/[0.02]" : ""}`}
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

          <textarea
            ref={textareaRef}
            value={promptValue}
            onChange={(e) => {
              onPromptValueChange(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="w-full bg-transparent text-[#E7E7E9] text-[14px] font-[500] px-3 py-2 min-h-[44px] max-h-[200px] outline-none resize-none placeholder:text-[#6B6B70] leading-snug"
            placeholder="Ask CodeUI to build..."
            rows={1}
          />

          <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/[0.04]">
            <div className="flex items-center gap-0.5">
              {promptValue.trim() && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onEnhance}
                      disabled={isEnhancing || isStartingProject}
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
              )}
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
                  <DropdownMenuItem
                    onSelect={onStartLandingPage}
                    className="cursor-pointer gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-xs"
                  >
                    <LayoutTemplate className="w-3.5 h-3.5" />
                    <span>Use landing page starter</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={onStartBlankProject}
                    className="cursor-pointer gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-xs"
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>Create blank project</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="h-3 w-px bg-white/[0.04]" />

              {/* File picker for images */}
              <label
                className={`flex items-center justify-center h-6 w-6 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg transition-colors ${(!isVisionCapableModel(selectedModelId) || isStartingProject) ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
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
                  disabled={isStartingProject || !isVisionCapableModel(selectedModelId)}
                />
                <Paperclip className="w-3 h-3" />
              </label>

              <div className="h-3 w-px bg-white/[0.04]" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1 px-1.5 h-6 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg text-[10px] font-normal transition-colors"
                    disabled={isLoadingModels || isStartingProject}
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
                        <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-52 bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]"
                >
                  {availableModels.map((model) => (
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
                  ))}
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

            <button
              onClick={handleSubmit}
              disabled={isStartingProject || !canSubmit}
              aria-label="Send prompt"
              className="flex items-center justify-center h-7 w-7 bg-[#121212] text-white rounded-lg transition-all hover:bg-[#1B1B1F] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none"
            >
              {isStartingProject ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <ActionButton
            icon={<LayoutTemplate className="w-3.5 h-3.5" />}
            label="Landing Page"
            onClick={isStartingProject ? undefined : onStartLandingPage}
          />
        </div>
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

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0E0E10] border border-white/[0.04] text-xs text-[#E7E7E9] hover:bg-[#1B1B1F] hover:border-white/[0.06] transition-colors focus-visible:outline-none"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
