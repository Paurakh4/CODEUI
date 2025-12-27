"use client"

import { useState, useEffect } from "react"
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
import { ALL_MODELS, type AIModel } from "@/lib/ai-models"

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
  const [enabledModels, setEnabledModels] = useState<AIModel[]>(ALL_MODELS)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch enabled models from API on mount
  useEffect(() => {
    setIsLoading(true)
    fetch('/api/ai/models')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        console.log('Fetched enabled models:', data)
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          setEnabledModels(data.models)
        } else {
          console.warn('No models returned from API, using all models')
          setEnabledModels(ALL_MODELS)
        }
      })
      .catch(err => {
        console.error('Failed to fetch enabled models:', err)
        // Fallback to all models if API fails
        setEnabledModels(ALL_MODELS)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const currentModel = enabledModels.find((m) => m.id === selectedModel) || enabledModels[0]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isLoading}
          className={cn(
            "h-8 gap-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800",
            "text-zinc-300 hover:text-zinc-100"
          )}
        >
          <ModelIcon model={currentModel} />
          <span className="max-w-[120px] truncate">
            {isLoading ? "Loading..." : currentModel.name}
          </span>
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
        
        {enabledModels.map((model) => (
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

// Re-export AIModel type for backward compatibility
export type { AIModel }
