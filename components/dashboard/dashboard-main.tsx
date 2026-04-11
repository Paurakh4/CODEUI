"use client"

import { Button } from "@/components/ui/button"
import { 
  Search, 
  Plus, 
  ArrowUp, 
  MoreHorizontal,
  Heart,
  ChevronRight,
  ChevronDown,
  Code,
  LayoutTemplate,
  ArrowLeft,
  Sparkles,
  Bot,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  FolderOpen,
  Crown,
  Info,
  Trash2
} from "lucide-react"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { UserMenu } from "@/components/user-menu"
import { FeedbackModal } from "@/components/feedback-modal"
import { PricingModal } from "@/components/pricing-modal"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession } from "next-auth/react"
import { useLiveCredits } from "@/hooks/use-live-credits"
import Link from "next/link"
import { useEditor } from "@/stores/editor-store"
import type { SubscriptionTier } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

// Credit tier configurations (matching lib/pricing.ts)
const TIER_CREDITS: Record<SubscriptionTier, number> = {
  free: 20,
  pro: 120,
  proplus: 350,
}

// Project type from API
interface Project {
  id: string
  name: string
  emoji?: string
  htmlContent?: string
  isPrivate: boolean
  views: number
  likes: number
  createdAt: string
  updatedAt: string
}

interface DashboardMainProps {
  onStart: (prompt?: string, model?: string) => void
  billingSyncState?: 'idle' | 'processing' | 'confirmed' | 'failed'
  billingSyncMessage?: string | null
  onRetryBillingSync?: () => void | Promise<void>
}

const PROJECT_CARD_DESKTOP_PREVIEW_WIDTH = 1440
const PROJECT_CARD_DESKTOP_PREVIEW_HEIGHT = 900

export function DashboardMain({
  onStart,
  billingSyncState = 'idle',
  billingSyncMessage = null,
  onRetryBillingSync,
}: DashboardMainProps) {
  const { data: session } = useSession()
  const { state, setModel } = useEditor()
  const { toast } = useToast()
  const selectedModelId = state.selectedModel
  const availableModels = state.availableModels
  const isLoadingModels = state.isLoadingModels
  const [view, setView] = useState<'dashboard' | 'projects'>('dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  
  // Close sidebar on mobile by default after mount
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
  }, [])
  const [promptValue, setPromptValue] = useState("")
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [isPricingOpen, setIsPricingOpen] = useState(false)
  const { credits: realTimeCredits, refreshCredits } = useLiveCredits({
    enabled: Boolean(session?.user),
    refreshIntervalMs: 30_000,
  })
  
  // Projects state
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch user's projects from API
  useEffect(() => {
    if (!session?.user) return

    setIsLoadingProjects(true)
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.projects && Array.isArray(data.projects)) {
          setProjects(data.projects)
        }
      })
      .catch(err => {
        console.error('Failed to fetch projects:', err)
      })
      .finally(() => {
        setIsLoadingProjects(false)
      })
  }, [session?.user?.id])

  useEffect(() => {
    if (billingSyncState === 'confirmed') {
      void refreshCredits()
    }
  }, [billingSyncState, refreshCredits])

  const adjustHeight = useCallback((reset?: boolean) => {
    const textarea = textareaRef.current
    if (!textarea) return

    if (reset) {
      textarea.style.height = '60px'
      return
    }

    textarea.style.height = '60px'
    const newHeight = Math.max(60, Math.min(textarea.scrollHeight, 200))
    textarea.style.height = `${newHeight}px`
  }, [])

  const focusPromptInput = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.focus()
    const caretPosition = textarea.value.length
    textarea.setSelectionRange(caretPosition, caretPosition)
    adjustHeight()
  }, [adjustHeight])

  const handleSend = () => {
    if (!promptValue.trim()) return
    onStart(promptValue.trim(), selectedModelId)
  }

  const startLandingPage = useCallback(() => {
    onStart(
      "Create a modern landing page with a hero section, features grid, and clear call-to-action.",
      selectedModelId,
    )
  }, [onStart, selectedModelId])

  const openCreditsInfo = useCallback(() => {
    setIsPricingOpen(true)
    toast({
      title: "Credits overview",
      description: "Monthly credits reset each billing cycle. Top-up credits stay available until you use them.",
    })
  }, [toast])

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('gemini') || modelId.includes('google')) return <Sparkles className="w-3.5 h-3.5" />
    if (modelId.includes('r1')) return <Bot className="w-3.5 h-3.5" />
    if (modelId.includes('deepseek-chat') || modelId.includes('v3')) return <Zap className="w-3.5 h-3.5" />
    return <Bot className="w-3.5 h-3.5" />
  }

  const selectedModelName = availableModels.find(m => m.id === selectedModelId)?.name || "Model"

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Get user credits from session (new credit system)
  const sessionUser = session?.user as { 
    monthlyCredits?: number
    topupCredits?: number
    totalCredits?: number
    credits?: number
    subscription?: SubscriptionTier
  }
  const userTier = realTimeCredits?.tier ?? sessionUser?.subscription ?? "free"
  const userMonthlyCredits = realTimeCredits?.monthlyCredits ?? sessionUser?.monthlyCredits ?? 0
  const userTopupCredits = realTimeCredits?.topupCredits ?? sessionUser?.topupCredits ?? 0
  const userTotalCredits = realTimeCredits?.totalCredits ?? sessionUser?.totalCredits ?? (userMonthlyCredits + userTopupCredits)
  const maxCredits = TIER_CREDITS[userTier] || 20

  // Calculate usage percentage based on remaining monthly credits
  const usagePercentage = Math.max(0, Math.min(100, (userMonthlyCredits / maxCredits) * 100))

  // Get tier display info
  const getTierBadge = () => {
    switch (userTier) {
      case "proplus":
        return { label: "Pro+", color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" }
      case "pro":
        return { label: "Pro", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" }
      default:
        return { label: "Free", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" }
    }
  }
  const tierBadge = getTierBadge()

  const normalizedSearchQuery = searchQuery.trim().toLowerCase()

  const visibleProjects = useMemo(() => {
    if (!normalizedSearchQuery) return projects
    return projects.filter((project) => project.name.toLowerCase().includes(normalizedSearchQuery))
  }, [projects, normalizedSearchQuery])

  const filteredProjects = useMemo(() => {
    if (!normalizedSearchQuery) return []
    return visibleProjects.slice(0, 8)
  }, [visibleProjects, normalizedSearchQuery])

  const recentProjects = useMemo(
    () => [...visibleProjects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8),
    [visibleProjects]
  )
  const savedProjects = useMemo(
    () => [...visibleProjects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6),
    [visibleProjects]
  )
  const dashboardProjects = useMemo(() => visibleProjects.slice(0, 4), [visibleProjects])

  const formatRelativeDate = useCallback((value: string) => {
    const date = new Date(value)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffMinutes < 1) return "just now"
    if (diffMinutes < 60) return `${diffMinutes}m`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d`

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }, [])

  const handleDeleteProject = useCallback(async (projectId: string) => {
    const confirmed = window.confirm("Delete this project? This action cannot be undone.")
    if (!confirmed) return

    setDeletingProjectId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
      if (!res.ok) {
        throw new Error("Failed to delete project")
      }
      setProjects((prev) => prev.filter((project) => project.id !== projectId))
    } catch (error) {
      console.error("Failed to delete project:", error)
    } finally {
      setDeletingProjectId(null)
    }
  }, [])

  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-white/20">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`
          fixed md:relative z-40 h-full flex-shrink-0 flex flex-col border-r border-white/10 bg-black transition-all duration-300 ease-in-out overflow-hidden
          ${isSidebarOpen ? 'w-[280px]' : 'w-0 border-r-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between whitespace-nowrap">
          <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-900 rounded-md cursor-pointer transition-colors overflow-hidden">
            <div className="w-5 h-5 bg-white text-black rounded flex-shrink-0 flex items-center justify-center text-xs font-bold">
              C
            </div>
            <span className="text-sm font-medium truncate">Personal</span>
            <span className={`text-[10px] ${tierBadge.bg} ${tierBadge.color} border ${tierBadge.border} px-1.5 py-0.5 rounded font-medium ml-1`}>
              {tierBadge.label}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Collapse sidebar"
            className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-900 focus-visible:ring-1 focus-visible:ring-zinc-500"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>

        {/* Go to Editor Button */}
        <div className="px-4 mb-4">
          <Button 
            onClick={() => onStart()}
            variant="outline" 
            className="w-full justify-start gap-2 bg-transparent border-white/10 text-zinc-300 hover:bg-zinc-900 hover:text-white h-9"
          >
            <Code className="w-4 h-4" />
            <span className="text-sm">Create Project</span>
          </Button>
        </div>

        {/* Navigation Items */}
        <ScrollArea className="flex-1 px-2 min-h-0">
          <div className="space-y-2 px-2 pt-1">
            <label htmlFor="project-search" className="text-[11px] font-medium text-zinc-500">
              Search projects
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                id="project-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => {
                  setTimeout(() => setIsSearchFocused(false), 120)
                }}
                placeholder="Search by project name"
                className="w-full h-9 bg-zinc-900 border border-white/10 rounded-md pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
                aria-label="Search projects"
              />
              {isSearchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute z-40 mt-2 w-full rounded-md border border-white/10 bg-zinc-950 shadow-xl overflow-hidden">
                  <div className="max-h-64 overflow-auto py-1">
                    {filteredProjects.length > 0 ? (
                      filteredProjects.map((project) => (
                        <Link
                          key={project.id}
                          href={`/project/${project.id}`}
                          onClick={() => {
                            setIsSearchFocused(false)
                            setSearchQuery("")
                          }}
                          className="block px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{project.name}</span>
                            <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                              {formatRelativeDate(project.updatedAt)}
                            </span>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-xs text-zinc-500 text-center">
                        No matching projects found.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="px-2">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-xs font-medium">Favorites</span>
                <span className="text-[10px] text-zinc-600">Coming soon</span>
              </div>
            </div>

            <div className="px-2">
              <div className="flex items-center justify-between text-zinc-500 hover:text-zinc-300 cursor-pointer group mb-2">
                <span className="text-xs font-medium">Recent Chats</span>
                <ChevronDown className="w-3 h-3" />
              </div>
              <div className="space-y-0.5">
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                  </div>
                ) : recentProjects.length > 0 ? (
                  recentProjects.map((project) => (
                    <Link 
                      key={project.id} 
                      href={`/project/${project.id}`}
                      className="block px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 rounded-md cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{project.name}</span>
                        <span className="text-[10px] text-zinc-600">{formatRelativeDate(project.updatedAt)}</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="px-2 py-3 text-xs text-zinc-500 text-center">
                    {normalizedSearchQuery ? "No recent chats match your search." : "No activity yet."}
                  </div>
                )}
              </div>
            </div>

            <div className="px-2">
              <div className="flex items-center justify-between text-zinc-500 hover:text-zinc-300 cursor-pointer group mb-2">
                <span className="text-xs font-medium">Saved Projects</span>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="space-y-0.5">
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                  </div>
                ) : savedProjects.length > 0 ? (
                  savedProjects.map((project) => (
                    <Link
                      key={`sidebar-${project.id}`}
                      href={`/project/${project.id}`}
                      className="block px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 rounded-md cursor-pointer truncate transition-colors"
                    >
                      {project.name}
                    </Link>
                  ))
                ) : (
                  <div className="px-2 py-3 text-xs text-zinc-500 text-center">
                    {normalizedSearchQuery ? "No saved projects match your search." : "No saved projects."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 space-y-4">
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-zinc-400">Credits</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            aria-label="How credits work"
                            onClick={openCreditsInfo}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <Info className="w-3 h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] bg-zinc-800 text-zinc-100 border border-zinc-700">
                          Credits are consumed when you run AI generation. Monthly credits reset every billing cycle.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-xs font-bold text-zinc-200">{userTotalCredits}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        usagePercentage > 20 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${usagePercentage}%` }}
                    />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-zinc-500">
                    {userMonthlyCredits} monthly credits
                  </p>
                </div>
                 <Button 
                   variant="link" 
                   onClick={() => setIsPricingOpen(true)}
                   className="h-auto p-0 text-[10px] text-amber-500 hover:text-amber-400 font-medium mt-1"
                 >
                     View plans →
                 </Button>
             </div>
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 overflow-y-auto">
        {!isSidebarOpen && (
          <div className="absolute top-4 left-4 z-30">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Expand sidebar"
              className="h-9 w-9 bg-black border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-900 focus-visible:ring-1 focus-visible:ring-zinc-500"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </Button>
          </div>
        )}
        {/* Top Navigation */}
        <header className="absolute top-0 right-0 p-4 z-20 flex items-center gap-2 sm:gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsPricingOpen(true)}
              className="hidden sm:flex text-zinc-400 hover:text-white hover:bg-zinc-900 h-8 text-xs"
            >
              Upgrade
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsFeedbackOpen(true)}
              className="hidden sm:flex text-zinc-400 hover:text-white hover:bg-zinc-900 h-8 text-xs"
            >
              Feedback
            </Button>
            <div 
              onClick={() => setIsPricingOpen(true)}
              className="flex items-center gap-2 bg-zinc-900/50 hover:bg-zinc-900 rounded-full px-3 py-1.5 sm:py-1 border border-white/10 transition-colors cursor-pointer group"
            >
                {userTier === 'proplus' ? (
                  <Crown className="w-3.5 h-3.5 text-purple-500 group-hover:scale-110 transition-transform" />
                ) : (
                  <Zap className={`w-3.5 h-3.5 ${userTier === 'pro' ? 'text-amber-500 fill-amber-500/20' : 'text-emerald-500 fill-emerald-500/20'} group-hover:scale-110 transition-transform`} />
                )}
                <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-zinc-100">{userTotalCredits}</span>
                    <span className="hidden sm:inline text-[10px] text-zinc-500 font-medium uppercase tracking-tight">Credits</span>
                </div>
            </div>
            <UserMenu />
        </header>

        {billingSyncState !== 'idle' && billingSyncMessage && (
          <div className="absolute top-16 left-1/2 z-20 w-[min(720px,calc(100%-2rem))] -translate-x-1/2 px-4">
            <div className={cn(
              "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur",
              billingSyncState === 'processing' && "border-sky-500/20 bg-sky-500/10 text-sky-100",
              billingSyncState === 'confirmed' && "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
              billingSyncState === 'failed' && "border-rose-500/20 bg-rose-500/10 text-rose-100",
            )}>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">
                  {billingSyncState === 'processing' && 'Upgrade processing'}
                  {billingSyncState === 'confirmed' && 'Upgrade confirmed'}
                  {billingSyncState === 'failed' && 'Upgrade needs attention'}
                </div>
                <div className="mt-1 text-sm leading-5 text-current/90">
                  {billingSyncMessage}
                </div>
              </div>
              {billingSyncState === 'failed' && onRetryBillingSync && (
                <Button
                  variant="outline"
                  onClick={() => void onRetryBillingSync()}
                  className="shrink-0 border-white/20 bg-black/20 text-white hover:bg-black/30"
                >
                  Retry check
                </Button>
              )}
            </div>
          </div>
        )}

        {view === 'dashboard' ? (
          <>
            {/* Center Content */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4 sm:px-6 z-10 pt-20 sm:pt-24 mt-10 md:mt-0">
                {/* Background Logo Effect */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 overflow-hidden">
                     <div className="text-[200px] sm:text-[300px] md:text-[400px] font-bold tracking-tighter select-none">CodeUI</div>
                </div>

                <div className="w-full max-w-3xl space-y-6 sm:space-y-8 relative">
                    <h1 className="text-3xl sm:text-4xl font-semibold text-center tracking-tight px-2">What do you want to create?</h1>
                    
                    {/* Input Area */}
                    <div className="relative group px-1 sm:px-0">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-white/20 to-white/10 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
                        <div className="relative bg-black border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                            <textarea 
                                ref={textareaRef}
                                value={promptValue}
                                onChange={(e) => {
                                    setPromptValue(e.target.value)
                                    adjustHeight()
                                }}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-transparent text-lg px-4 py-4 min-h-[60px] max-h-[200px] outline-none resize-none placeholder:text-zinc-500"
                                placeholder="Ask CodeUI to build..."
                                rows={1}
                            />
                            <div className="flex items-center justify-between px-3 py-2 border-t border-white/5 bg-white/[0.02]">
                                <div className="flex items-center gap-2">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg">
                                          <Plus className="w-5 h-5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start" className="w-56 bg-zinc-950 border-white/10 text-zinc-300">
                                        <DropdownMenuItem onSelect={focusPromptInput} className="cursor-pointer gap-2 focus:bg-zinc-900 focus:text-white">
                                          <Plus className="w-4 h-4" />
                                          <span>Continue writing prompt</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={startLandingPage} className="cursor-pointer gap-2 focus:bg-zinc-900 focus:text-white">
                                          <LayoutTemplate className="w-4 h-4" />
                                          <span>Use landing page starter</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => onStart(undefined, selectedModelId)} className="cursor-pointer gap-2 focus:bg-zinc-900 focus:text-white">
                                          <Code className="w-4 h-4" />
                                          <span>Create blank project</span>
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                    <div className="h-4 w-px bg-white/10 mx-1"></div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-8 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg gap-2 text-xs font-normal px-2 outline-none focus-visible:ring-0"
                                                disabled={isLoadingModels}
                                            >
                                                {isLoadingModels ? (
                                                  <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Loading...</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <div className="text-zinc-400">
                                                        {getModelIcon(selectedModelId)}
                                                    </div>
                                                    {selectedModelName}
                                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                                  </>
                                                )}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-56 bg-zinc-950 border-white/10 text-zinc-300">
                                            {availableModels.map((model) => (
                                                <DropdownMenuItem 
                                                    key={model.id}
                                                    onClick={() => setModel(model.id)}
                                                    className="gap-2 focus:bg-zinc-900 focus:text-white cursor-pointer py-2"
                                                >
                                                    <div className="text-zinc-500 group-focus:text-white">
                                                        {getModelIcon(model.id)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-medium">{model.name}</span>
                                                    </div>
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <Button 
                                    onClick={handleSend}
                                    size="icon" 
                                  aria-label="Send prompt"
                                  className="h-8 w-8 bg-zinc-800 text-white hover:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    <ArrowUp className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <ActionButton 
                          icon={<LayoutTemplate className="w-4 h-4" />} 
                          label="Landing Page" 
                          onClick={startLandingPage}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Projects Section */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pb-8 pt-10 sm:pt-12 z-10">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <div>
                        <h2 className="text-base sm:text-lg font-semibold mb-0.5 sm:mb-1">My Projects</h2>
                        <p className="text-xs sm:text-sm text-zinc-500">Explore what you have built with CodeUI.</p>
                    </div>
                    {visibleProjects.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setView('projects')}
                        className="text-xs sm:text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 group"
                      >
                          Browse All <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    )}
                </div>

                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                  </div>
                ) : visibleProjects.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {dashboardProjects.map((project) => (
                          <ProjectCard 
                            key={project.id} 
                            project={project} 
                            onDelete={handleDeleteProject}
                            isDeleting={deletingProjectId === project.id}
                          />
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FolderOpen className="w-12 h-12 text-zinc-600 mb-4" />
                    <h3 className="text-lg font-medium text-zinc-300 mb-2">
                      {normalizedSearchQuery ? "No matching projects" : "No projects yet"}
                    </h3>
                    <p className="text-sm text-zinc-500 mb-4">
                      {normalizedSearchQuery ? "Try a different search term." : "Start by creating your first project above!"}
                    </p>
                  </div>
                )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col w-full max-w-[1400px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-8 min-h-0 overflow-y-auto">
            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 mt-4 md:mt-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setView('dashboard')}
                className="h-8 w-8 sm:h-9 sm:w-9 text-zinc-400 hover:text-white hover:bg-zinc-900 border border-white/10 shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">My Projects</h1>
                <p className="text-xs sm:text-sm text-zinc-500">A collection of everything you've created.</p>
              </div>
            </div>

            <div className="-mx-1 px-1 sm:-mx-2 sm:px-2">
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                </div>
              ) : visibleProjects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 pb-8">
                  {visibleProjects.map((project) => (
                    <ProjectCard 
                      key={project.id} 
                      project={project} 
                      onDelete={handleDeleteProject}
                      isDeleting={deletingProjectId === project.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="w-12 h-12 text-zinc-600 mb-4" />
                  <h3 className="text-lg font-medium text-zinc-300 mb-2">
                    {normalizedSearchQuery ? "No matching projects" : "No projects yet"}
                  </h3>
                  <p className="text-sm text-zinc-500">
                    {normalizedSearchQuery ? "Try a different search term." : "Start by creating your first project!"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
      />
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        currentTier={userTier}
      />
    </div>
  )
}

function ProjectCard({ project, onDelete, isDeleting = false }: { 
  project: Project
  onDelete?: (projectId: string) => void
  isDeleting?: boolean
}) {
  // Format numbers for display
  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  // Generate a gradient based on project id for visual variety
  const gradients = [
    "bg-gradient-to-br from-zinc-700 to-zinc-900",
    "bg-gradient-to-br from-zinc-600 to-zinc-800",
    "bg-gradient-to-br from-zinc-800 to-black",
    "bg-gradient-to-br from-zinc-700 to-zinc-950",
    "bg-gradient-to-br from-zinc-900 to-zinc-700",
    "bg-gradient-to-br from-zinc-800 to-zinc-600",
  ]
  const gradientIndex = project.id.charCodeAt(project.id.length - 1) % gradients.length
  const bgGradient = gradients[gradientIndex]
  const hasPreviewHtml = Boolean(project.htmlContent && project.htmlContent.trim().length > 0)

  return (
    <Link href={`/project/${project.id}`} className="block">
      <div className="group relative bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all cursor-pointer">
        {/* Preview Image */}
        <div className={`aspect-video w-full relative transition-all duration-300 ${hasPreviewHtml ? "bg-zinc-950" : `${bgGradient} grayscale group-hover:grayscale-0`}`}>
          {hasPreviewHtml ? (
            <ProjectCardPreview
              htmlContent={project.htmlContent!}
              projectName={project.name}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl opacity-50 group-hover:opacity-80 transition-opacity">
                {project.emoji || "🎨"}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
          {/* Overlay Controls */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  aria-label={`Actions for ${project.name}`}
                  className="h-8 w-8 rounded-full bg-black/50 hover:bg-black text-white border border-white/10"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-950 border-white/10 text-zinc-200">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    if (!isDeleting) onDelete?.(project.id)
                  }}
                  className="gap-2 cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
                  disabled={isDeleting}
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? "Deleting..." : "Delete project"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Private indicator */}
          {project.isPrivate && (
            <div className="absolute top-2 left-2">
              <span className="text-[10px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded border border-white/10">
                Private
              </span>
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="p-3">
          <h3 className="font-medium text-sm text-zinc-200 truncate mb-2">{project.name}</h3>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">{formatNumber(project.views)} views</span>
              <span>•</span>
              <div className="flex items-center gap-0.5">
                <Heart className="w-3 h-3" />
                <span>{formatNumber(project.likes)}</span>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Free
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ProjectCardPreview({ htmlContent, projectName }: { htmlContent: string; projectName: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.1)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScale = () => {
      const { width, height } = container.getBoundingClientRect()
      if (width <= 0 || height <= 0) return

      const nextScale = Math.min(
        width / PROJECT_CARD_DESKTOP_PREVIEW_WIDTH,
        height / PROJECT_CARD_DESKTOP_PREVIEW_HEIGHT,
      )

      setPreviewScale((currentScale) =>
        Math.abs(currentScale - nextScale) < 0.001 ? currentScale : nextScale,
      )
    }

    updateScale()

    const observer = new ResizeObserver(() => {
      updateScale()
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-zinc-950">
      <div
        className="absolute left-1/2 top-0 origin-top"
        style={{
          width: PROJECT_CARD_DESKTOP_PREVIEW_WIDTH,
          height: PROJECT_CARD_DESKTOP_PREVIEW_HEIGHT,
          transform: `translateX(-50%) scale(${previewScale})`,
        }}
      >
        <iframe
          title={`${projectName} preview`}
          srcDoc={htmlContent}
          sandbox="allow-scripts"
          loading="lazy"
          tabIndex={-1}
          className="block h-full w-full border-0 bg-white pointer-events-none"
        />
      </div>
    </div>
  )
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
    return (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-zinc-900/50 hover:bg-zinc-800 text-sm text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
  >
            {icon}
            <span>{label}</span>
        </button>
    )
}
