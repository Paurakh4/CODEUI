"use client"

import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { useAccountModals } from "@/components/account-modal-provider"
import {
  PanelLeft,
  Save,
  Redo,
  Undo,
  Clock,
  Monitor,
  Tablet,
  Smartphone,
  Download,
  Eye,
  Palette,
  Code2,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Crown,
  Settings,
  Share,
} from "lucide-react"
import { useState, useCallback, useEffect, useRef } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useLiveCredits } from "@/hooks/use-live-credits"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { SubscriptionTier } from "@/lib/pricing"

type ViewMode = "preview" | "design" | "code"
type DeviceMode = "desktop" | "tablet" | "mobile"

interface TopNavProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  deviceMode?: DeviceMode
  onDeviceModeChange?: (mode: DeviceMode) => void
  onExport?: () => void
  onSave?: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onHistoryOpen?: () => void
  isGenerating?: boolean
  hasUnsavedChanges?: boolean
  primaryColor?: string
  secondaryColor?: string
  theme?: "light" | "dark"
  onPrimaryColorChange?: (color: string) => void
  onSecondaryColorChange?: (color: string) => void
  onThemeChange?: (theme: "light" | "dark") => void
}

export function TopNav({
  sidebarOpen,
  onToggleSidebar,
  viewMode = "preview",
  onViewModeChange,
  deviceMode = "desktop",
  onDeviceModeChange,
  onExport,
  onSave,
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = true,
  onHistoryOpen,
  isGenerating = false,
  hasUnsavedChanges = false,
  primaryColor: _primaryColor = "blue",
  secondaryColor: _secondaryColor = "slate",
  theme: _theme = "dark",
  onPrimaryColorChange: _onPrimaryColorChange,
  onSecondaryColorChange: _onSecondaryColorChange,
  onThemeChange: _onThemeChange,
}: TopNavProps) {
  const [copied, setCopied] = useState(false)
  const copyResetTimeoutRef = useRef<number | null>(null)
  const { showPricing, showSettings } = useAccountModals()
  const { credits: liveCredits, refreshCredits } = useLiveCredits({
    refreshIntervalMs: 30_000,
  })

  // Refetch when generation finishes
  const prevIsGenerating = useRef(isGenerating)
  useEffect(() => {
    if (prevIsGenerating.current && !isGenerating) {
      void refreshCredits()
    }
    prevIsGenerating.current = isGenerating
  }, [isGenerating, refreshCredits])

  const userTier = (liveCredits?.tier ?? "free") as SubscriptionTier
  const userMonthlyCredits = liveCredits?.monthlyCredits ?? 0
  const userTopupCredits = liveCredits?.topupCredits ?? 0
  const userTotalCredits = liveCredits?.totalCredits ?? (userMonthlyCredits + userTopupCredits)

  // Get tier display info
  const getTierBadge = () => {
    switch (userTier) {
      case "proplus":
        return { icon: Crown, color: "text-amber-400", bg: "bg-amber-400/10" }
      case "pro":
        return { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" }
      default:
        return { icon: Zap, color: "text-emerald-500", bg: "bg-emerald-500/10" }
    }
  }
  const tierBadge = getTierBadge()
  const TierIcon = tierBadge.icon

  const tabs = [
    { id: "preview" as ViewMode, label: "Preview", icon: Eye },
    { id: "design" as ViewMode, label: "Design", icon: Palette },
    { id: "code" as ViewMode, label: "Code", icon: Code2 },
  ]

  const viewModes = [
    { id: "desktop" as DeviceMode, label: "Desktop", icon: Monitor },
    { id: "tablet" as DeviceMode, label: "Tablet", icon: Tablet },
    { id: "mobile" as DeviceMode, label: "Mobile", icon: Smartphone },
  ]

  const getPreviewIframe = useCallback(() => {
    return document.querySelector('[data-preview-frame="true"]') as HTMLIFrameElement | null
  }, [])

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      const iframe = getPreviewIframe()
      const html = iframe?.contentDocument?.documentElement?.outerHTML?.trim()

      if (!html) {
        toast.error("Copy failed", {
          description: "Preview HTML is not ready yet.",
        })
        return
      }

      await navigator.clipboard.writeText(html)
      setCopied(true)

      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }

      toast.success("Copied HTML", {
        description: "The current preview HTML was copied to your clipboard.",
      })
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        copyResetTimeoutRef.current = null
      }, 2200)
    } catch (error) {
      console.error("Failed to copy HTML:", error)
      toast.error("Copy failed", {
        description: "The preview HTML could not be copied.",
      })
    }
  }, [getPreviewIframe, toast])

  const handleOpenInNewTab = useCallback(() => {
    // Open preview in new tab
    const iframe = getPreviewIframe()
    if (iframe) {
      const htmlContent = iframe.contentDocument?.documentElement.outerHTML || ''
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    }
  }, [getPreviewIframe])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-9 flex items-center px-3 bg-zinc-950 border-b border-white/[0.04]">
        {/* Left Section */}
        <div className="flex items-center gap-1.5 flex-1">
          {/* Sidebar Toggle */}
          {!sidebarOpen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1 h-6 hover:bg-white/[0.04] rounded-md text-zinc-400 hover:text-zinc-200 transition-colors"
                  onClick={onToggleSidebar}
                  aria-label="Open sidebar"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open sidebar</TooltipContent>
            </Tooltip>
          )}

          {/* View Mode Tabs — segmented control */}
          <div className="flex items-center gap-0.5 bg-white/[0.025] rounded-lg p-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = viewMode === tab.id
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onViewModeChange?.(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 h-6 rounded-md text-[12px] font-medium transition-all duration-200",
                        isActive
                          ? "bg-white/[0.10] text-zinc-100 shadow-[0_1px_3px_rgba(0,0,0,0.4),0_0_0_0.5px_rgba(255,255,255,0.08)]"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {tab.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>

          {/* Action Buttons — separated group */}
          <div className="hidden sm:flex items-center gap-0.5 ml-2 pl-2.5 border-l border-white/[0.06]">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSave}
                  aria-label="Save checkpoint"
                  className={`p-1.5 h-7 hover:bg-white/[0.04] rounded-md transition-colors ${hasUnsavedChanges ? "text-orange-400" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Save {hasUnsavedChanges && "(unsaved changes)"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  aria-label="Undo"
                  className="p-1.5 h-7 hover:bg-white/[0.04] rounded-md text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                >
                  <Undo className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Undo (⌘Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  aria-label="Redo"
                  className="p-1.5 h-7 hover:bg-white/[0.04] rounded-md text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                >
                  <Redo className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Redo (⌘⇧Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onHistoryOpen}
                  aria-label="Open history"
                  className="p-1.5 h-7 hover:bg-white/[0.04] rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">History</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1.5">
          {/* Credits Display */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={showPricing}
                aria-label="Open plans and top-up credits"
                className="flex items-center gap-1.5 hover:bg-white/[0.04] rounded-full px-2 py-0.5 transition-colors cursor-pointer group"
              >
                <TierIcon className={cn("w-3.5 h-3.5 group-hover:scale-110 transition-transform", tierBadge.color)} />
                <span className="text-[12px] font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">{userTotalCredits}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {userMonthlyCredits} monthly credits and {userTopupCredits} top-up credits. Click to view plans or buy a one-time credit pack.
            </TooltipContent>
          </Tooltip>

          {/* Device Viewport Switcher — separated group */}
          <div className="hidden md:flex items-center gap-0.5 ml-1.5 pl-2.5 border-l border-white/[0.06]">
            {viewModes.map((mode) => {
              const Icon = mode.icon
              const isActive = deviceMode === mode.id
              return (
                <Tooltip key={mode.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onDeviceModeChange?.(mode.id)}
                      aria-label={`Switch to ${mode.label.toLowerCase()} viewport`}
                      className={cn(
                        "p-1.5 h-7 rounded-md transition-all duration-200",
                        isActive
                          ? "bg-white/[0.08] text-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_0.5px_rgba(255,255,255,0.06)]"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{mode.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>

          {/* Export & Actions — separated group */}
          <div className="flex items-center gap-0.5 ml-1.5 pl-2.5 border-l border-white/[0.06]">
            {/* Copy Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopy}
                  aria-label="Copy HTML"
                  className={cn(
                    "p-1.5 h-7 rounded-md transition-colors",
                    copied
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]",
                  )}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {copied ? "Copied!" : "Copy HTML"}
              </TooltipContent>
            </Tooltip>

            {/* Export Button */}
            <button
              onClick={onExport}
              aria-label="Export project"
              className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
            >
              <Download className="w-3.5 h-3.5 flex-none" />
              <span className="hidden sm:inline leading-none">Export</span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleOpenInNewTab}
              aria-label="Share project"
              className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
            >
              <Share className="w-3.5 h-3.5 flex-none" />
              <span className="hidden sm:inline leading-none">Share</span>
            </button>

            {/* Open in New Tab */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleOpenInNewTab}
                  aria-label="Open preview in a new tab"
                  className="p-1.5 h-7 hover:bg-white/[0.04] rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open in new tab</TooltipContent>
            </Tooltip>
          </div>

          {/* Settings & User — separated group */}
          <div className="flex items-center gap-0.5 ml-1.5 pl-2.5 border-l border-white/[0.06]">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={showSettings}
                  aria-label="Open settings"
                  className="p-1.5 h-7 hover:bg-white/[0.04] rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings</TooltipContent>
            </Tooltip>

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
