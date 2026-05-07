"use client"

import { Button } from "@/components/ui/button"
import { Sparkles, Bot, Zap } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { FeedbackModal } from "@/components/feedback-modal"
import { PricingModal } from "@/components/pricing-modal"
import { useSession } from "next-auth/react"
import { useLiveCredits } from "@/hooks/use-live-credits"
import { useAuthDialog } from "@/components/auth-dialog-provider"
import { useEditor } from "@/stores/editor-store"
import type { SubscriptionTier } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { DashboardTopNav } from "@/components/dashboard/dashboard-top-nav"
import { DashboardPromptArea } from "@/components/dashboard/dashboard-prompt-area"
import { DashboardProjectsGrid } from "@/components/dashboard/dashboard-projects-grid"

const TIER_CREDITS: Record<SubscriptionTier, number> = {
  free: 20,
  pro: 120,
  proplus: 350,
}

interface Project {
  id: string
  name: string
  emoji?: string
  htmlContent?: string
  isPrivate: boolean
  isFavorite: boolean
  views: number
  likes: number
  createdAt: string
  updatedAt: string
}

interface DashboardMainProps {
  onStart: (prompt?: string, model?: string) => void
  isStartingProject?: boolean
  billingSyncState?: "idle" | "processing" | "confirmed" | "failed"
  billingSyncMessage?: string | null
  isPricingOpen?: boolean
  onPricingOpenChange?: (open: boolean) => void
  onRetryBillingSync?: () => void | Promise<void>
}

export function DashboardMain({
  onStart,
  isStartingProject = false,
  billingSyncState = "idle",
  billingSyncMessage = null,
  isPricingOpen: controlledPricingOpen,
  onPricingOpenChange,
  onRetryBillingSync,
}: DashboardMainProps) {
  const { data: session } = useSession()
  const { showSignIn } = useAuthDialog()
  const { state, setModel } = useEditor()
  const { toast } = useToast()
  const selectedModelId = state.selectedModel
  const availableModels = state.availableModels
  const isLoadingModels = state.isLoadingModels
  const [view, setView] = useState<"dashboard" | "projects">("dashboard")

  const [promptValue, setPromptValue] = useState("")
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [internalPricingOpen, setInternalPricingOpen] = useState(false)
  const { credits: realTimeCredits, refreshCredits } = useLiveCredits({
    enabled: Boolean(session?.user),
    refreshIntervalMs: 30_000,
  })
  const isPricingOpen = controlledPricingOpen ?? internalPricingOpen
  const setPricingOpen = useCallback(
    (open: boolean) => {
      if (onPricingOpenChange) {
        onPricingOpenChange(open)
        return
      }
      setInternalPricingOpen(open)
    },
    [onPricingOpenChange],
  )

  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [updatingFavoriteIds, setUpdatingFavoriteIds] = useState<string[]>([])
  const [updatingVisibilityIds, setUpdatingVisibilityIds] = useState<string[]>([])

  useEffect(() => {
    if (!session?.user) return
    setIsLoadingProjects(true)
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.projects && Array.isArray(data.projects)) {
          setProjects(data.projects)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch projects:", err)
      })
      .finally(() => {
        setIsLoadingProjects(false)
      })
  }, [session?.user?.id])

  useEffect(() => {
    if (billingSyncState === "confirmed") {
      void refreshCredits()
    }
  }, [billingSyncState, refreshCredits])

  const handleSend = () => {
    if (!promptValue.trim() || isStartingProject) return
    onStart(promptValue.trim(), selectedModelId)
  }

  const handleEnhancePrompt = useCallback(async () => {
    const trimmedPrompt = promptValue.trim()
    if (!trimmedPrompt || isEnhancing) return
    if (!session?.user) {
      showSignIn()
      return
    }
    setIsEnhancing(true)
    try {
      const response = await fetch("/api/ai/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          model: selectedModelId,
          strength: "standard",
        }),
      })
      if (response.status === 401) {
        showSignIn()
        return
      }
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Failed to enhance prompt")
      }
      const enhancedPrompt =
        typeof data?.enhancedPrompt === "string" && data.enhancedPrompt.trim()
          ? data.enhancedPrompt.trim()
          : trimmedPrompt
      setPromptValue(enhancedPrompt)
    } catch (error) {
      toast({
        title: "Prompt Enhance unavailable",
        description:
          error instanceof Error ? error.message : "Failed to enhance prompt.",
        variant: "destructive",
      })
    } finally {
      setIsEnhancing(false)
    }
  }, [isEnhancing, promptValue, selectedModelId, session?.user, showSignIn, toast])

  const startLandingPage = useCallback(() => {
    onStart(
      "Create a modern landing page with a hero section, features grid, and clear call-to-action.",
      selectedModelId,
    )
  }, [onStart, selectedModelId])

  const getModelIcon = (modelId: string) => {
    if (modelId.includes("gemini") || modelId.includes("google"))
      return <Sparkles className="w-3.5 h-3.5" />
    if (modelId.includes("r1")) return <Bot className="w-3.5 h-3.5" />
    if (modelId.includes("deepseek-chat") || modelId.includes("v3"))
      return <Zap className="w-3.5 h-3.5" />
    return <Bot className="w-3.5 h-3.5" />
  }

  const selectedModelName =
    availableModels.find((m) => m.id === selectedModelId)?.name || "Model"

  const sessionUser = session?.user as {
    monthlyCredits?: number
    topupCredits?: number
    totalCredits?: number
    credits?: number
    subscription?: SubscriptionTier
  }
  const userTier =
    realTimeCredits?.tier ?? sessionUser?.subscription ?? "free"
  const userMonthlyCredits =
    realTimeCredits?.monthlyCredits ?? sessionUser?.monthlyCredits ?? 0
  const userTopupCredits =
    realTimeCredits?.topupCredits ?? sessionUser?.topupCredits ?? 0
  const userTotalCredits =
    realTimeCredits?.totalCredits ??
    sessionUser?.totalCredits ??
    userMonthlyCredits + userTopupCredits
  const maxCredits = TIER_CREDITS[userTier] || 20
  const usagePercentage = Math.max(
    0,
    Math.min(100, (userMonthlyCredits / maxCredits) * 100),
  )

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
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  }, [])

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      const confirmed = window.confirm(
        "Delete this project? This action cannot be undone.",
      )
      if (!confirmed) return
      setDeletingProjectId(projectId)
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error("Failed to delete project")
        setProjects((prev) => prev.filter((p) => p.id !== projectId))
      } catch (error) {
        console.error("Failed to delete project:", error)
      } finally {
        setDeletingProjectId(null)
      }
    },
    [],
  )

  const handleToggleFavorite = useCallback(
    async (projectId: string) => {
      const targetProject = projects.find((p) => p.id === projectId)
      if (!targetProject) return
      const next = !targetProject.isFavorite
      setUpdatingFavoriteIds((cur) => [...cur, projectId])
      setProjects((cur) =>
        cur.map((p) =>
          p.id === projectId ? { ...p, isFavorite: next } : p,
        ),
      )
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFavorite: next }),
        })
        if (!response.ok) throw new Error("Failed to update favorite")
        const data = await response.json()
        const updatedProject = data.project as Project | undefined
        if (updatedProject) {
          setProjects((cur) =>
            cur.map((p) => (p.id === projectId ? updatedProject : p)),
          )
        }
      } catch (error) {
        console.error("Failed to update favorite:", error)
        setProjects((cur) =>
          cur.map((p) =>
            p.id === projectId
              ? { ...p, isFavorite: targetProject.isFavorite }
              : p,
          ),
        )
        toast({
          title: "Favorite update failed",
          description: "The project favorite state could not be saved.",
          variant: "destructive",
        })
      } finally {
        setUpdatingFavoriteIds((cur) => cur.filter((id) => id !== projectId))
      }
    },
    [projects, toast],
  )

  const handleToggleVisibility = useCallback(
    async (projectId: string) => {
      const targetProject = projects.find((p) => p.id === projectId)
      if (!targetProject) return
      const next = !targetProject.isPrivate
      setUpdatingVisibilityIds((cur) =>
        cur.includes(projectId) ? cur : [...cur, projectId],
      )
      setProjects((cur) =>
        cur.map((p) =>
          p.id === projectId ? { ...p, isPrivate: next } : p,
        ),
      )
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPrivate: next }),
        })
        if (!response.ok) throw new Error("Failed to update project visibility")
        const data = await response.json()
        const updatedProject = data.project as Project | undefined
        if (updatedProject) {
          setProjects((cur) =>
            cur.map((p) => (p.id === projectId ? updatedProject : p)),
          )
        }
        toast({
          title: next ? "Project is now private" : "Project is now public",
          description: next
            ? "The project was removed from public discover."
            : "Anyone can now open the project from the discover gallery in read-only mode.",
        })
      } catch (error) {
        console.error("Failed to update project visibility:", error)
        setProjects((cur) =>
          cur.map((p) =>
            p.id === projectId
              ? { ...p, isPrivate: targetProject.isPrivate }
              : p,
          ),
        )
        toast({
          title: "Visibility update failed",
          description: "The project visibility could not be saved.",
          variant: "destructive",
        })
      } finally {
        setUpdatingVisibilityIds((cur) => cur.filter((id) => id !== projectId))
      }
    },
    [projects, toast],
  )

  const handleOpenPublicProject = useCallback((projectId: string) => {
    window.open(`/discover/${projectId}`, "_blank", "noopener,noreferrer")
  }, [])

  useEffect(() => {
    const html = document.documentElement
    html.style.overflowX = "hidden"
    html.style.overflowY = "hidden"
    return () => {
      html.style.overflowX = ""
      html.style.overflowY = ""
    }
  }, [])

  return (
    <SidebarProvider defaultOpen={true} className="h-svh max-h-[100dvh] overflow-hidden">
        {/* Grain overlay */}
        <div className="grain-overlay" />

        <DashboardSidebar
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        onStart={onStart}
        onOpenPricing={() => setPricingOpen(true)}
        onViewChange={setView}
        userTier={userTier}
        userTotalCredits={userTotalCredits}
        userMonthlyCredits={userMonthlyCredits}
        usagePercentage={usagePercentage}
        formatRelativeDate={formatRelativeDate}
      />

      <SidebarInset className="relative flex flex-col overflow-y-auto overflow-x-hidden min-h-0 min-w-0 bg-background">
        {/* Top Navigation */}
        <DashboardTopNav
          userTier={userTier}
          userTotalCredits={userTotalCredits}
          onOpenPricing={() => setPricingOpen(true)}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
        />

        {/* Billing Sync Banner */}
        {billingSyncState !== "idle" && billingSyncMessage && (
          <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 pt-2 z-10">
            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 shadow-md backdrop-blur-md",
                  billingSyncState === "processing" &&
                    "border-white/10 bg-white/5 text-[#E7E7E9]",
                  billingSyncState === "confirmed" &&
                    "border-white/10 bg-white/5 text-[#E7E7E9]",
                billingSyncState === "failed" &&
                   "border-white/10 bg-white/5 text-[#E7E7E9]",
              )}
            >
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
                  {billingSyncState === "processing" && "Upgrade processing"}
                  {billingSyncState === "confirmed" && "Upgrade confirmed"}
                  {billingSyncState === "failed" && "Upgrade needs attention"}
                </div>
                <div className="mt-0.5 text-xs leading-4 text-current/90">
                  {billingSyncMessage}
                </div>
              </div>
              {billingSyncState === "failed" && onRetryBillingSync && (
                <Button
                  variant="outline"
                  onClick={() => void onRetryBillingSync()}
                  className="shrink-0 border-white/20 bg-black/20 text-white hover:bg-black/30 rounded-lg h-7 text-[11px]"
                >
                  Retry check
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="relative z-10 flex-1 flex flex-col">
          {view === "dashboard" ? (
            <DashboardPromptArea
              promptValue={promptValue}
              onPromptValueChange={setPromptValue}
              onSend={handleSend}
              onEnhance={handleEnhancePrompt}
              isEnhancing={isEnhancing}
              isStartingProject={isStartingProject}
              selectedModelId={selectedModelId}
              selectedModelName={selectedModelName}
              availableModels={availableModels}
              isLoadingModels={isLoadingModels}
              getModelIcon={getModelIcon}
              onModelChange={setModel}
              onStartLandingPage={startLandingPage}
              onStartBlankProject={() => {
                if (!isStartingProject) {
                  onStart(undefined, selectedModelId)
                }
              }}
            />
          ) : (
            <DashboardProjectsGrid
              projects={projects}
              isLoading={isLoadingProjects}
              searchQuery=""
              view="projects"
              onViewChange={setView}
              onDelete={handleDeleteProject}
              onToggleFavorite={handleToggleFavorite}
              onToggleVisibility={handleToggleVisibility}
              onOpenPublic={handleOpenPublicProject}
              isDeleting={deletingProjectId}
              updatingFavoriteIds={updatingFavoriteIds}
              updatingVisibilityIds={updatingVisibilityIds}
            />
          )}
        </div>
      </SidebarInset>

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setPricingOpen(false)}
        currentTier={userTier}
      />
    </SidebarProvider>
  )
}
