"use client"

import { useRef, useCallback } from "react"
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
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

interface DashboardPromptAreaProps {
  promptValue: string
  onPromptValueChange: (value: string) => void
  onSend: () => void
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback((reset?: boolean) => {
    const textarea = textareaRef.current
    if (!textarea) return
    if (reset) {
      textarea.style.height = "44px"
      return
    }
    textarea.style.height = "44px"
    const newHeight = Math.max(44, Math.min(textarea.scrollHeight, 160))
    textarea.style.height = `${newHeight}px`
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
        onSend()
      }
    }
  }

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
        <div className="input-card">
          <textarea
            ref={textareaRef}
            value={promptValue}
            onChange={(e) => {
              onPromptValueChange(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-[#E7E7E9] text-[14px] font-[500] px-3 py-2 min-h-[44px] max-h-[160px] outline-none resize-none placeholder:text-[#6B6B70] leading-snug"
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
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <button
              onClick={onSend}
              disabled={isStartingProject || !promptValue.trim()}
              aria-label="Send prompt"
              className="flex items-center justify-center h-7 w-7 bg-[#121212] text-white rounded-lg transition-all hover:bg-[#1B1B1F] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0E10]"
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
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0E0E10] border border-white/[0.04] text-xs text-[#E7E7E9] hover:bg-[#1B1B1F] hover:border-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
