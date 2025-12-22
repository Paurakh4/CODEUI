"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { PanelLeft, Save, Redo, Undo, X, Monitor, Tablet, Smartphone, Download, Eye, Palette, Code2, ExternalLink } from "lucide-react"

interface TopNavProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

type TabType = "preview" | "design" | "code"
type ViewModeType = "desktop" | "tablet" | "mobile"

export function TopNav({ sidebarOpen, onToggleSidebar }: TopNavProps) {
  const [activeTab, setActiveTab] = useState<TabType>("preview")
  const [activeViewMode, setActiveViewMode] = useState<ViewModeType>("desktop")

  const tabs = [
    { id: "preview" as TabType, label: "Preview", icon: Eye },
    { id: "design" as TabType, label: "Design", icon: Palette },
    { id: "code" as TabType, label: "Code", icon: Code2 },
  ]

  const viewModes = [
    { id: "desktop" as ViewModeType, label: "Desktop", icon: Monitor },
    { id: "tablet" as ViewModeType, label: "Tablet", icon: Tablet },
    { id: "mobile" as ViewModeType, label: "Mobile", icon: Smartphone },
  ]

  const actionButtons = [
    { id: "save", label: "Save", icon: Save },
    { id: "undo", label: "Undo", icon: Undo },
    { id: "redo", label: "Redo", icon: Redo },
    { id: "close", label: "Close", icon: X },
  ]

  return (
    <div className="h-12 flex items-center px-2 bg-[#1c1c1c]">
      {/* Left Section - Sidebar toggle + Tabs + Action buttons */}
      <div className="flex items-center gap-3 flex-1">
        <button
          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-300 transition-all duration-200"
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                  ${isActive
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  }
                `}
                title={tab.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            )
          })}
        </div>

        <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
          {actionButtons.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300 transition-all duration-200"
                title={action.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Section - View modes + Export */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
          {viewModes.map((mode) => {
            const Icon = mode.icon
            const isActive = activeViewMode === mode.id
            return (
              <button
                key={mode.id}
                onClick={() => setActiveViewMode(mode.id)}
                className={`
                  p-1.5 rounded-md transition-all duration-200
                  ${isActive
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  }
                `}
                title={mode.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            )
          })}
        </div>

        <button className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 px-3 py-1.5 h-8 text-xs font-medium rounded-lg shadow-sm border border-zinc-700 transition-all duration-200 hover:shadow-md">
          <Download className="w-3.5 h-3.5" />
          Export
        </button>

        <button className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 px-3 py-1.5 h-8 text-xs font-medium rounded-lg shadow-sm border border-zinc-700 transition-all duration-200 hover:shadow-md">
          <ExternalLink className="w-3.5 h-3.5" />
          Open in new tab
        </button>

        <UserMenu />
      </div>
    </div>
  )
}
