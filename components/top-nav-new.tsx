"use client"

import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { 
  PanelLeft, 
  Save, 
  Redo, 
  Undo, 
  Monitor, 
  Tablet, 
  Smartphone, 
  Download, 
  Eye, 
  Palette, 
  Code2, 
  ExternalLink,
  Copy,
  Check
} from "lucide-react"
import { useState, useCallback } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  isGenerating?: boolean
  hasUnsavedChanges?: boolean
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
  isGenerating = false,
  hasUnsavedChanges = false,
}: TopNavProps) {
  const [copied, setCopied] = useState(false)

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
                  className="p-1.5 h-6 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
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
                  className="p-1.5 h-6 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Redo className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Redo (⌘⇧Z)</TooltipContent>
            </Tooltip>
          </div>


        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1.5">
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
                className="p-1.5 h-6 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Open in new tab</TooltipContent>
          </Tooltip>

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </TooltipProvider>
  )
}
