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
      textarea.style.height = "60px"
      return
    }
    textarea.style.height = "60px"
    const newHeight = Math.max(60, Math.min(textarea.scrollHeight, 200))
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
      onSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4 sm:px-6 pt-2 sm:pt-4 pb-4">
      <div className="w-full max-w-3xl space-y-5 sm:space-y-6 relative">
        {/* Radial Vignette */}
        <div className="vignette" style={{ top: "-60px", left: "50%" }} />

        {/* Headline */}
        <div className="flex flex-col items-center">
          <h1 className="text-[28px] sm:text-[34px] font-bold text-center tracking-tight text-white text-glow leading-tight">
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
            className="w-full bg-transparent text-[#E7E7E9] text-[15px] font-[500] px-4 py-3 min-h-[52px] max-h-[180px] outline-none resize-none placeholder:text-[#6B6B70] leading-relaxed"
            placeholder="Ask CodeUI to build..."
            rows={1}
          />

          <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.04]">
            <div className="flex items-center gap-1">
              {promptValue.trim() && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onEnhance}
                      disabled={isEnhancing}
                      aria-label="Enhance prompt"
                      className="flex items-center justify-center h-7 w-7 text-[#9B9B9F] hover:text-white hover:bg-[#1B1B1F] rounded-lg transition-colors"
                    >
                      {isEnhancing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-[#0E0E10] text-[#E7E7E9] border-white/[0.04] text-xs">
                    Improve this prompt
                  </TooltipContent>
                </Tooltip>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center h-7 w-7 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-56 bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]"
                >
                  <DropdownMenuItem
                    onSelect={handleContinueWriting}
                    className="cursor-pointer gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Continue writing prompt</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={onStartLandingPage}
                    className="cursor-pointer gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-sm"
                  >
                    <LayoutTemplate className="w-4 h-4" />
                    <span>Use landing page starter</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={onStartBlankProject}
                    className="cursor-pointer gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-sm"
                  >
                    <Code className="w-4 h-4" />
                    <span>Create blank project</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="h-4 w-px bg-white/[0.04]" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1 px-2 h-7 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg text-[11px] font-normal transition-colors"
                    disabled={isLoadingModels}
                  >
                    {isLoadingModels ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[#9B9B9F]">{getModelIcon(selectedModelId)}</span>
                        <span className="text-[12px] font-[400] tracking-[0.02em]">{selectedModelName}</span>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-56 bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]"
                >
                  {availableModels.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => onModelChange(model.id)}
                      className="gap-2 focus:bg-[#1B1B1F] focus:text-[#E7E7E9] cursor-pointer py-2 text-sm"
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
              aria-label="Send prompt"
              className="flex items-center justify-center h-8 w-8 bg-[#121212] text-white rounded-lg transition-all hover:bg-[#1B1B1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0E10]"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <ActionButton
            icon={<LayoutTemplate className="w-4 h-4" />}
            label="Landing Page"
            onClick={onStartLandingPage}
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
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0E0E10] border border-white/[0.04] text-sm text-[#E7E7E9] hover:bg-[#1B1B1F] hover:border-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
