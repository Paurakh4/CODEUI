"use client"

import { useState } from "react"
import { Check, ChevronDown, Sparkles, Zap, Brain } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export interface AIModel {
  id: string
  name: string
  provider: string
  description?: string
  contextLength: number
  supportsReasoning?: boolean
  isFast?: boolean
  isNew?: boolean
}

const AI_MODELS: AIModel[] = [
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    description: "Powerful general-purpose model",
    contextLength: 64000,
    isFast: true,
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Advanced reasoning model",
    contextLength: 64000,
    supportsReasoning: true,
  },
  {
    id: "qwen/qwen3-coder-480b-instruct",
    name: "Qwen3 Coder 480B",
    provider: "Qwen",
    description: "Specialized for coding tasks",
    contextLength: 32000,
    isNew: true,
  },
  {
    id: "moonshot/kimi-k2-instruct",
    name: "Kimi K2",
    provider: "Moonshot",
    description: "Great for creative content",
    contextLength: 128000,
  },
  {
    id: "moonshot/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "Moonshot",
    description: "Reasoning-enhanced Kimi",
    contextLength: 128000,
    supportsReasoning: true,
  },
  {
    id: "zhipu/glm-4.6",
    name: "GLM 4.6",
    provider: "Zhipu",
    description: "Balanced performance",
    contextLength: 128000,
  },
  {
    id: "mistralai/devstral-2512:free",
    name: "Devstral",
    provider: "Mistral",
    description: "Devstral 2512 (free)",
    contextLength: 64000,
    isFast: true,
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    provider: "Google",
    description: "Latest Gemini model preview",
    contextLength: 2000000,
    isFast: true,
    isNew: true,
  },
]

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (modelId: string) => void
  disabled?: boolean
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)

  const currentModel = AI_MODELS.find((m) => m.id === selectedModel) || AI_MODELS[0]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 gap-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800",
            "text-zinc-300 hover:text-zinc-100"
          )}
        >
          <ModelIcon model={currentModel} />
          <span className="max-w-[120px] truncate">{currentModel.name}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[280px] bg-zinc-950 border-zinc-800"
      >
        <DropdownMenuLabel className="text-zinc-400 text-xs">
          AI Models
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800" />
        
        {AI_MODELS.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => {
              onModelChange(model.id)
              setOpen(false)
            }}
            className={cn(
              "flex items-start gap-3 py-2.5 cursor-pointer",
              "focus:bg-zinc-800 focus:text-zinc-100",
              selectedModel === model.id && "bg-zinc-800/50"
            )}
          >
            <div className="mt-0.5">
              <ModelIcon model={model} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  {model.name}
                </span>
                {model.isNew && (
                  <span className="text-[10px] font-medium bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded">
                    NEW
                  </span>
                )}
                {model.supportsReasoning && (
                  <span className="text-[10px] font-medium bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                    REASONING
                  </span>
                )}
                {model.isFast && (
                  <span className="text-[10px] font-medium bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded">
                    FAST
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{model.description}</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                {model.provider} • {(model.contextLength / 1000).toFixed(0)}K context
              </p>
            </div>
            {selectedModel === model.id && (
              <Check className="w-4 h-4 text-purple-400 mt-0.5" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModelIcon({ model }: { model: AIModel }) {
  if (model.supportsReasoning) {
    return <Brain className="w-4 h-4 text-purple-400" />
  }
  if (model.isFast) {
    return <Zap className="w-4 h-4 text-yellow-400" />
  }
  return <Sparkles className="w-4 h-4 text-blue-400" />
}

export { AI_MODELS }
