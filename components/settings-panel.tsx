"use client"

import { useState } from "react"
import { Settings, X, Palette, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
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
  onPrimaryColorChange: (color: string) => void
  onSecondaryColorChange: (color: string) => void
  onThemeChange: (theme: "light" | "dark") => void
  trigger?: React.ReactNode
}

export function SettingsPanel({
  primaryColor,
  secondaryColor,
  theme,
  onPrimaryColorChange,
  onSecondaryColorChange,
  onThemeChange,
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
            className="h-8 w-8 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg"
          >
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[360px] bg-[#0E0E10] border-white/[0.06] p-0">
        <SheetHeader className="p-4 border-b border-white/[0.04]">
          <SheetTitle className="text-[#E7E7E9] flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Settings className="w-4 h-4 text-[#9B9B9F]" />
            Settings
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-5">
          {/* Theme Toggle */}
          <div className="space-y-2.5">
            <Label className="text-[10px] text-[#6B6B70] uppercase tracking-[0.05em] font-medium">
              Theme
            </Label>
            <div className="flex items-center gap-1.5 p-0.5 bg-[#0E0E10] rounded-lg border border-white/[0.04]">
              <button
                onClick={() => onThemeChange("light")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-[11px] font-medium transition-colors",
                  theme === "light"
                    ? "bg-[#1B1B1F] text-[#E7E7E9]"
                    : "text-[#6B6B70] hover:text-[#9B9B9F]"
                )}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
              <button
                onClick={() => onThemeChange("dark")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-[11px] font-medium transition-colors",
                  theme === "dark"
                    ? "bg-[#1B1B1F] text-[#E7E7E9]"
                    : "text-[#6B6B70] hover:text-[#9B9B9F]"
                )}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
            </div>
          </div>

          {/* Primary Color */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-[#6B6B70] uppercase tracking-[0.05em] font-medium">
                Primary Color
              </Label>
              <div
                className="w-5 h-5 rounded-md border border-white/[0.06]"
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
                    "w-5 h-5 rounded-md transition-transform hover:scale-110",
                    primaryColor === color.name &&
                      "ring-2 ring-white ring-offset-2 ring-offset-[#0E0E10]"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Secondary Color */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-[#6B6B70] uppercase tracking-[0.05em] font-medium">
                Secondary Color
              </Label>
              <div
                className="w-5 h-5 rounded-md border border-white/[0.06]"
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
                    "w-5 h-5 rounded-md transition-transform hover:scale-110",
                    secondaryColor === color.name &&
                      "ring-2 ring-white ring-offset-2 ring-offset-[#0E0E10]"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Color Preview */}
          <div className="space-y-2">
            <Label className="text-[10px] text-[#6B6B70] uppercase tracking-[0.05em] font-medium">
              Preview
            </Label>
            <div
              className="h-24 rounded-lg p-4 flex flex-col justify-end border border-white/[0.04]"
              style={{
                background: `linear-gradient(135deg, ${
                  TAILWIND_COLORS.find((c) => c.name === primaryColor)?.value
                } 0%, ${
                  TAILWIND_COLORS.find((c) => c.name === secondaryColor)?.dark
                } 100%)`,
              }}
            >
              <div className="text-white font-bold text-sm">Sample Title</div>
              <div className="text-white/60 text-[11px]">Generated website preview</div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { TAILWIND_COLORS }
