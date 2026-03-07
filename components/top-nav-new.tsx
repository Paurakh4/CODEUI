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
  Settings
} from "lucide-react"
import { useState, useCallback, useEffect, useRef } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

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
  enhancedPrompts?: boolean
  onPrimaryColorChange?: (color: string) => void
  onSecondaryColorChange?: (color: string) => void
  onThemeChange?: (theme: "light" | "dark") => void
  onEnhancedPromptsChange?: (enabled: boolean) => void
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
  enhancedPrompts: _enhancedPrompts = false,
  onPrimaryColorChange: _onPrimaryColorChange,
  onSecondaryColorChange: _onSecondaryColorChange,
  onThemeChange: _onThemeChange,
  onEnhancedPromptsChange: _onEnhancedPromptsChange,
}: TopNavProps) {
  const [copied, setCopied] = useState(false)
  const { data: session, update: updateSession } = useSession()
  const { showSettings } = useAccountModals()

  // Credit system logic (matching dashboard-main.tsx)
  const [realTimeCredits, setRealTimeCredits] = useState<{
    monthlyCredits: number;
    topupCredits: number;
    totalCredits: number;
  } | null>(null)
  const hasUpdatedSession = useRef(false)

  // Fetch fresh credits
  const fetchCredits = useCallback(() => {
    fetch('/api/user/credits')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setRealTimeCredits({
            monthlyCredits: data.monthlyCredits,
            topupCredits: data.topupCredits,
            totalCredits: data.totalCredits
          })
          
          // If session is stale, trigger an update (only once per mount to avoid loops)
          const sessionUser = session?.user as any
          if (
            sessionUser && 
            !hasUpdatedSession.current &&
            (sessionUser.monthlyCredits !== data.monthlyCredits ||
             sessionUser.topupCredits !== data.topupCredits)
          ) {
            hasUpdatedSession.current = true
            updateSession()
          }
        }
      })
      .catch(err => console.error('Failed to fetch credits:', err))
  }, [session?.user, updateSession])

  // Initial fetch
  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  // Refetch when generation finishes
  const prevIsGenerating = useRef(isGenerating)
  useEffect(() => {
    if (prevIsGenerating.current && !isGenerating) {
      fetchCredits()
    }
    prevIsGenerating.current = isGenerating
  }, [isGenerating, fetchCredits])

  const sessionUser = session?.user as { 
    monthlyCredits?: number
    topupCredits?: number
    totalCredits?: number
    credits?: number
    subscription?: string
  }
  const userTier = sessionUser?.subscription || "free"
  const userMonthlyCredits = realTimeCredits?.monthlyCredits ?? sessionUser?.monthlyCredits ?? 0
  const userTopupCredits = realTimeCredits?.topupCredits ?? sessionUser?.topupCredits ?? 0
  const userTotalCredits = realTimeCredits?.totalCredits ?? sessionUser?.totalCredits ?? (userMonthlyCredits + userTopupCredits)

  // Get tier display info
  const getTierBadge = () => {
    switch (userTier) {
      case "proplus":
        return { icon: Crown, color: "text-purple-500", bg: "bg-purple-500/10" }
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

  const handleCopy = useCallback(() => {
    // Copy current HTML to clipboard
    navigator.clipboard.writeText(document.querySelector('iframe')?.contentDocument?.documentElement.outerHTML || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const handleOpenInNewTab = useCallback(() => {
    // Open preview in new tab
    const iframe = document.querySelector('iframe') as HTMLIFrameElement
    if (iframe) {
      const htmlContent = iframe.contentDocument?.documentElement.outerHTML || ''
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    }
  }, [])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-10 flex items-center px-3 bg-[#0a0a0a]">
        {/* Left Section */}
        <div className="flex items-center gap-1.5 flex-1">
          {/* Sidebar Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1.5 h-6 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
                onClick={onToggleSidebar}
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {sidebarOpen ? "Close sidebar" : "Open sidebar"}
            </TooltipContent>
          </Tooltip>

          {/* View Mode Tabs */}
          <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = viewMode === tab.id
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onViewModeChange?.(tab.id)}
                      className={`
                        flex items-center gap-1 px-2 py-1.5 h-6 rounded-md text-xs font-medium transition-all
                        ${isActive
                          ? "bg-zinc-800 text-zinc-100 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                        }
                      `}
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

          {/* Action Buttons */}
          <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSave}
                  aria-label="Save checkpoint"
                  className={`p-1.5 h-6 hover:bg-zinc-800 rounded-md transition-colors ${
                    hasUnsavedChanges ? "text-orange-400" : "text-zinc-500 hover:text-zinc-300"
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
                  className="p-1.5 h-6 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-500"
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
                  className="p-1.5 h-6 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-500"
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
                  className="p-1.5 h-6 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
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
              <div className="flex items-center gap-2 bg-zinc-900/50 hover:bg-zinc-900 rounded-full px-3 py-1 border border-white/10 transition-colors cursor-pointer group">
                <TierIcon className={cn("w-3.5 h-3.5 group-hover:scale-110 transition-transform", tierBadge.color)} />
                <span className="text-xs font-bold text-zinc-100">{userTotalCredits}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {userMonthlyCredits} monthly{userTopupCredits > 0 ? ` + ${userTopupCredits} bonus` : ''} credits. Credits are used when AI generation runs.
            </TooltipContent>
          </Tooltip>

          {/* Device Viewport Switcher */}
          <div className="hidden md:flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
            {viewModes.map((mode) => {
              const Icon = mode.icon
              const isActive = deviceMode === mode.id
              return (
                <Tooltip key={mode.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onDeviceModeChange?.(mode.id)}
                      aria-label={`Switch to ${mode.label.toLowerCase()} viewport`}
                      className={`
                        p-1.5 h-6 rounded-md transition-all
                        ${isActive
                          ? "bg-zinc-800 text-zinc-100 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                        }
                      `}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{mode.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>

          {/* Copy Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleCopy}
                aria-label="Copy HTML"
                className="p-1.5 h-6 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
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
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            aria-label="Export project"
            className="h-6 hover:bg-zinc-700 text-xs border-zinc-800"
            style={{ backgroundColor: '#18181B', borderColor: '#27272A' }}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Export
          </Button>

          {/* Open in New Tab */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleOpenInNewTab}
                aria-label="Open preview in a new tab"
                className="p-1.5 h-6 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Open in new tab</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={showSettings}
                aria-label="Open settings"
                className="p-1.5 h-6 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
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
    </TooltipProvider>
  )
}
