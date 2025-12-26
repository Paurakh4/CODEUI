"use client"

import { useState } from "react"
import { Settings, X, Palette, Sparkles, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// Tailwind color palette
const TAILWIND_COLORS = [
  { name: "slate", value: "#64748b", dark: "#1e293b" },
  { name: "gray", value: "#6b7280", dark: "#1f2937" },
  { name: "zinc", value: "#71717a", dark: "#27272a" },
  { name: "neutral", value: "#737373", dark: "#262626" },
  { name: "stone", value: "#78716c", dark: "#292524" },
  { name: "red", value: "#ef4444", dark: "#991b1b" },
  { name: "orange", value: "#f97316", dark: "#9a3412" },
  { name: "amber", value: "#f59e0b", dark: "#92400e" },
  { name: "yellow", value: "#eab308", dark: "#854d0e" },
  { name: "lime", value: "#84cc16", dark: "#3f6212" },
  { name: "green", value: "#22c55e", dark: "#166534" },
  { name: "emerald", value: "#10b981", dark: "#065f46" },
  { name: "teal", value: "#14b8a6", dark: "#115e59" },
  { name: "cyan", value: "#06b6d4", dark: "#155e75" },
  { name: "sky", value: "#0ea5e9", dark: "#075985" },
  { name: "blue", value: "#3b82f6", dark: "#1e40af" },
  { name: "indigo", value: "#6366f1", dark: "#3730a3" },
  { name: "violet", value: "#8b5cf6", dark: "#5b21b6" },
  { name: "purple", value: "#a855f7", dark: "#7e22ce" },
  { name: "fuchsia", value: "#d946ef", dark: "#a21caf" },
  { name: "pink", value: "#ec4899", dark: "#9d174d" },
  { name: "rose", value: "#f43f5e", dark: "#9f1239" },
]

interface SettingsPanelProps {
  primaryColor: string
  secondaryColor: string
  theme: "light" | "dark"
  enhancedPrompts: boolean
  onPrimaryColorChange: (color: string) => void
  onSecondaryColorChange: (color: string) => void
  onThemeChange: (theme: "light" | "dark") => void
  onEnhancedPromptsChange: (enabled: boolean) => void
  trigger?: React.ReactNode
}

export function SettingsPanel({
  primaryColor,
  secondaryColor,
  theme,
  enhancedPrompts,
  onPrimaryColorChange,
  onSecondaryColorChange,
  onThemeChange,
  onEnhancedPromptsChange,
  trigger,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
          >
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[360px] bg-zinc-950 border-zinc-800 p-0">
        <SheetHeader className="p-4 border-b border-zinc-800">
          <SheetTitle className="text-zinc-100 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-6">
          {/* Theme Toggle */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-zinc-200">Theme</Label>
            <div className="flex items-center gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
              <button
                onClick={() => onThemeChange("light")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm transition-colors",
                  theme === "light"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
              <button
                onClick={() => onThemeChange("dark")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm transition-colors",
                  theme === "dark"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
            </div>
          </div>

          {/* Primary Color */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-zinc-200">Primary Color</Label>
              <div
                className="w-6 h-6 rounded-md border border-zinc-700"
                style={{
                  backgroundColor:
                    TAILWIND_COLORS.find((c) => c.name === primaryColor)?.value,
                }}
              />
            </div>
            <div className="grid grid-cols-11 gap-1.5">
              {TAILWIND_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => onPrimaryColorChange(color.name)}
                  className={cn(
                    "w-6 h-6 rounded-md transition-transform hover:scale-110",
                    primaryColor === color.name &&
                      "ring-2 ring-white ring-offset-2 ring-offset-zinc-950"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Secondary Color */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-zinc-200">
                Secondary Color
              </Label>
              <div
                className="w-6 h-6 rounded-md border border-zinc-700"
                style={{
                  backgroundColor:
                    TAILWIND_COLORS.find((c) => c.name === secondaryColor)?.value,
                }}
              />
            </div>
            <div className="grid grid-cols-11 gap-1.5">
              {TAILWIND_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => onSecondaryColorChange(color.name)}
                  className={cn(
                    "w-6 h-6 rounded-md transition-transform hover:scale-110",
                    secondaryColor === color.name &&
                      "ring-2 ring-white ring-offset-2 ring-offset-zinc-950"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Enhanced Prompts */}
          <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-200">
                  Enhanced Prompts
                </Label>
                <p className="text-xs text-zinc-500">
                  Add more details to your prompts
                </p>
              </div>
            </div>
            <Switch
              checked={enhancedPrompts}
              onCheckedChange={onEnhancedPromptsChange}
            />
          </div>

          {/* Color Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-zinc-200">Preview</Label>
            <div
              className="h-24 rounded-lg p-4 flex flex-col justify-end"
              style={{
                background: `linear-gradient(135deg, ${
                  TAILWIND_COLORS.find((c) => c.name === primaryColor)?.value
                } 0%, ${
                  TAILWIND_COLORS.find((c) => c.name === secondaryColor)?.dark
                } 100%)`,
              }}
            >
              <div className="text-white font-bold text-lg">Sample Title</div>
              <div className="text-white/70 text-sm">Generated website preview</div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { TAILWIND_COLORS }
