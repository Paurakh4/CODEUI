"use client"

import { useEffect, useState, useCallback, useRef, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { TopNav } from "@/components/top-nav-new"
import { VersionHistory, type Version as HistoryVersion } from "@/components/version-history"
import { AI_Prompt } from "@/components/ui/animated-ai-input"
import { PreviewFrame, type SelectedElementInfo } from "@/components/preview-frame"
import { CodeEditor } from "@/components/code-editor"
import { StylePanel, type SelectedElement, type StyleProperty, type StyleChange } from "@/components/style-panel"
import { TextShimmer } from "@/components/ui/text-shimmer";
import { ChevronDown, ChevronLeft, X, ChevronUp, RotateCcw } from "lucide-react"
import { SolarCodeSquareLinear } from "@/components/solar-code-square-linear"
import { useSession } from "next-auth/react"
import { useAuthDialog } from "@/components/auth-dialog-provider"
import { useAIChat } from "@/hooks/use-ai-chat"
import { useStyleHistory } from "@/hooks/use-style-history"
import { useEditor } from "@/stores/editor-store"
import { useToast } from "@/hooks/use-toast"
import { StreamParser } from "@/lib/parsers/stream-parser"
import { cn } from "@/lib/utils"
import { convertHtmlToReactComponent, sanitizeFileName } from "@/lib/utils/export"
import { deriveProjectNameFromPrompt, isDefaultProjectName, normalizeProjectName } from "@/lib/utils/project-name"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Debounce helper for auto-save
function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    }) as T,
    [delay]
  )
}

type ViewMode = "preview" | "design" | "code"
type DeviceMode = "desktop" | "tablet" | "mobile"
type ExportFormat = "html" | "react"
type CheckpointKind = "auto" | "manual" | "restore"
type CheckpointTrigger = "before-ai" | "after-ai" | "manual-save" | "restore"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  isThinking?: boolean
  thinkingContent?: string
}

interface CheckpointOptions {
  silent?: boolean
  kind?: CheckpointKind
  trigger?: CheckpointTrigger
  restoredFromId?: string
}

interface PendingRecovery {
  prompt: string
  failedFiles: string[]
  model?: string
}

const MONGO_OBJECT_ID_REGEX = /^[a-f\d]{24}$/i

const coerceVersionId = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)

  if (value != null) {
    const normalized = String(value)
    if (normalized && normalized !== "[object Object]") {
      return normalized
    }
  }

  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const CINEMATHEQUE_TEMPLATE_ENDPOINT = "/api/templates/cinematheque-preview"
const TEXT_CONTENT_PROPERTY = "__textContent__"
const LOADING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Loading preview…</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: #0b0b0c; color: #eaeaea; }
    .wrap { min-height: 100vh; display: grid; place-items: center; }
    .card { max-width: 560px; padding: 24px 20px; border: 1px solid #222; background: #121214; }
    .muted { color: #a1a1aa; margin-top: 8px; }
  </style>
</head>
<body>
  <!-- CINEMATHEQUE_TEMPLATE_LOADING -->
  <div class="wrap">
    <div class="card">
      <div>Loading Cinematheque preview template…</div>
      <div class="muted">If this persists, refresh the preview.</div>
    </div>
  </div>
</body>
</html>`

// Random prompt examples for the dice button
const EXAMPLE_PROMPTS = [
  "A modern portfolio website for a photographer with a dark theme and image gallery",
  "A SaaS landing page with pricing cards, testimonials, and a hero section",
  "A restaurant website with menu, about section, and reservation form",
  "A fitness app landing page with features, testimonials, and download buttons",
  "A personal blog homepage with recent posts and newsletter signup",
  "An e-commerce product page with image gallery, reviews, and add to cart",
  "A startup landing page with animated hero, team section, and contact form",
  "A music streaming app landing with playlist preview and feature highlights",
]

interface EditorLayoutNewProps {
  initialPrompt?: string
  initialModel?: string
  onBack?: () => void
  projectId?: string
}

export function EditorLayoutNew({ initialPrompt, initialModel, onBack, projectId }: EditorLayoutNewProps) {
  const router = useRouter()
  const {
    state,
    setModel,
    setApplyingPatch,
    setPrimaryColor,
    setSecondaryColor,
    setTheme,
    setEnhancedPrompts,
  } = useEditor()
  const { toast } = useToast()
  
  const storageKey = projectId ? `editor_state_${projectId}` : "editor_state"

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("preview")
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop")
  const [draftAiOutput, setDraftAiOutput] = useState("")
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>("html")
  
  // Project State
  const [projectName, setProjectName] = useState("untitled-project")
  const [htmlContent, setHtmlContent] = useState(LOADING_HTML)
  const htmlContentRef = useRef(htmlContent)

  const [versions, setVersions] = useState<HistoryVersion[]>([])
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [previewHtmlContent, setPreviewHtmlContent] = useState<string | null>(null)

  useEffect(() => {
    htmlContentRef.current = htmlContent
  }, [htmlContent])

  const normalizeVersion = useCallback((version: any): HistoryVersion => {
    const timestamp = version.createdAt || version.timestamp
    const rawId = version?._id ?? version?.id
    return {
      id: coerceVersionId(rawId),
      htmlContent: version.htmlContent || version.content || "",
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      description: version.description || undefined,
    }
  }, [])

  const makeLocalVersion = useCallback((content: string, description?: string): HistoryVersion => {
    return {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      htmlContent: content,
      timestamp: new Date(),
      description,
    }
  }, [])

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null)
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([])
  const [thinkingExpanded, setThinkingExpanded] = useState(true)
  const hasProcessedInitialPrompt = useRef(false)
  const lastUserPromptRef = useRef("")
  const recoveryInFlightRef = useRef(false)
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecovery | null>(null)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  
  // Sync initialModel with global store
  useEffect(() => {
    if (initialModel) {
      setModel(initialModel)
    }
  }, [initialModel, setModel])

  // Style History for undo/redo
  const [styleHistoryState, styleHistoryActions] = useStyleHistory(30)
  
  // Track pending style updates for smooth animations
  const pendingStyleUpdate = useRef<{ property: string; value: StyleProperty } | null>(null)
  const lastAppliedHtml = useRef<string>("")
  const previewRef = useRef<HTMLIFrameElement>(null)
  const isStyleUpdate = useRef(false)
  
  // MongoDB sync refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false)
  const lastSavedContentRef = useRef<string>("")

  // Auth
  const { data: session } = useSession()
  const { showSignIn } = useAuthDialog()
  
  const [isRestored, setIsRestored] = useState(false)
  const [isLoadingProject, setIsLoadingProject] = useState(false)

  const applyChangeToIframe = useCallback((selector: string, property: string, value: StyleProperty) => {
    const iframe = previewRef.current
    const doc = iframe?.contentDocument
    if (!doc) return

    try {
      const element = doc.querySelector(selector) as HTMLElement | null
      if (!element) return

      if (property === TEXT_CONTENT_PROPERTY) {
        element.textContent = value?.toString() ?? ""
        return
      }

      element.style[property as any] = value?.toString() ?? ""
    } catch {
      // Ignore selector errors
    }
  }, [])

  // Save project to MongoDB
  const saveProjectToMongo = useCallback(async (content: string, name?: string) => {
    if (!projectId || projectId === "new" || !session?.user?.id) return
    if (isSavingRef.current) return
    if (content === lastSavedContentRef.current && !name) return
    
    isSavingRef.current = true
    try {
      const updateData: Record<string, string> = { htmlContent: content }
      if (name) updateData.name = name

      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })
      
      if (res.ok) {
        lastSavedContentRef.current = content
        setHasUnsavedChanges(false)
      } else {
        console.error("Failed to save project to MongoDB")
      }
    } catch (error) {
      console.error("Error saving project:", error)
    } finally {
      isSavingRef.current = false
    }
  }, [projectId, session?.user?.id])

  // Debounced auto-save (2 seconds after last change)
  const debouncedSave = useDebouncedCallback((content: string) => {
    saveProjectToMongo(content)
  }, 2000)

  // Save messages to MongoDB
  const saveMessageToMongo = useCallback(async (message: { role: "user" | "assistant"; content: string; thinkingContent?: string }) => {
    if (!projectId || projectId === "new" || !session?.user?.id) return
    
    try {
      await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      })
    } catch (error) {
      console.error("Error saving message:", error)
    }
  }, [projectId, session?.user?.id])

  // Save version to MongoDB
  const saveVersionToMongo = useCallback(async (
    htmlContent: string,
    description?: string,
    options?: CheckpointOptions
  ) => {
    if (!projectId || projectId === "new" || !session?.user?.id) return null
    
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          htmlContent,
          description,
          kind: options?.kind,
          trigger: options?.trigger,
          restoredFromId: options?.restoredFromId,
        }),
      })

      if (!res.ok) {
        return null
      }

      const data = await res.json()
      return data?.version || null
    } catch (error) {
      console.error("Error saving version:", error)
      return null
    }
  }, [projectId, session?.user?.id])

  const createCheckpoint = useCallback(async (
    description?: string,
    options?: CheckpointOptions
  ) => {
    const content = htmlContentRef.current || htmlContent
    if (!content) return

    const savedVersion = await saveVersionToMongo(content, description, options)
    const nextVersion = savedVersion
      ? normalizeVersion(savedVersion)
      : makeLocalVersion(content, description)

    setVersions((prev) => [...prev, nextVersion])
    setCurrentVersionId(nextVersion.id)
    if (savedVersion || !projectId || projectId === "new" || !session?.user?.id) {
      lastSavedContentRef.current = content
      setHasUnsavedChanges(false)
    }

    if (!options?.silent) {
      toast({
        title: "Checkpoint saved",
        description: description || "Saved a new version.",
      })
    }
  }, [htmlContent, makeLocalVersion, normalizeVersion, projectId, saveVersionToMongo, session?.user?.id, toast])

  // Load project from MongoDB on mount (if projectId exists)
  useEffect(() => {
    if (!projectId || projectId === "new" || !session?.user?.id) return
    
    let cancelled = false
    setIsLoadingProject(true)

    ;(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) {
          if (res.status === 404) {
            toast({ title: "Project not found", variant: "destructive" })
            router.push("/dashboard")
          }
          return
        }

        const data = await res.json()
        if (cancelled) return

        const project = data.project
        if (project) {
          setProjectName(project.name || "Untitled Project")
          if (project.htmlContent) {
            setHtmlContent(project.htmlContent)
            lastSavedContentRef.current = project.htmlContent
          }
          // Restore messages from MongoDB
          if (project.messages && project.messages.length > 0) {
            const restoredMessages = project.messages.map((m: { role: string; content: string; thinkingContent?: string; createdAt: string }, index: number) => ({
              id: `mongo_${index}_${Date.now()}`,
              role: m.role,
              content: m.content,
              thinkingContent: m.thinkingContent,
              timestamp: new Date(m.createdAt),
              isThinking: false,
            }))
            setMessages(restoredMessages)
            setHasGeneratedOnce(true)
          }
        }
      } catch (error) {
        console.error("Error loading project:", error)
        toast({ title: "Failed to load project", variant: "destructive" })
      } finally {
        if (!cancelled) {
          setIsLoadingProject(false)
          setIsRestored(true)
        }
      }
    })()

    return () => { cancelled = true }
  }, [projectId, session?.user?.id, router, toast])

  // Load version history from MongoDB
  useEffect(() => {
    if (!projectId || projectId === "new" || !session?.user?.id) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/versions`)
        if (!res.ok) return

        const data = await res.json()
        if (cancelled) return

        if (Array.isArray(data?.versions)) {
          const normalized = data.versions.map(normalizeVersion)
          setVersions(normalized)
          const latest = normalized[normalized.length - 1]
          if (latest) {
            setCurrentVersionId(latest.id)
          }
        }
      } catch (error) {
        console.error("Error loading versions:", error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, session?.user?.id, normalizeVersion])

  // Load state from localStorage (fallback for new projects or when no projectId)
  useEffect(() => {
    // Skip localStorage restore if we're loading from MongoDB
    if (projectId && projectId !== "new" && session?.user?.id) return
    
    const savedState = localStorage.getItem(storageKey)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        if (parsed.htmlContent) setHtmlContent(parsed.htmlContent)
        if (parsed.projectName) setProjectName(parsed.projectName)
        // Convert date strings back to Date objects for messages
        if (parsed.messages) {
          const restoredMessages = parsed.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
          setMessages(restoredMessages)
        }
        if (parsed.viewMode) setViewMode(parsed.viewMode)
        if (parsed.deviceMode) setDeviceMode(parsed.deviceMode)
        if (parsed.hasGeneratedOnce) setHasGeneratedOnce(parsed.hasGeneratedOnce)
        if (parsed.sidebarOpen !== undefined) setSidebarOpen(parsed.sidebarOpen)
      } catch (e) {
        console.error("Failed to restore editor state", e)
      }
    }
    setIsRestored(true)
  }, [storageKey, projectId, session?.user?.id])

  // Save state to localStorage
  useEffect(() => {
    if (!isRestored) return

    const stateToSave = {
      htmlContent,
      projectName,
      messages,
      viewMode,
      deviceMode,
      hasGeneratedOnce,
      sidebarOpen,
      lastSaved: new Date().toISOString()
    }
    localStorage.setItem(storageKey, JSON.stringify(stateToSave))
  }, [htmlContent, projectName, messages, viewMode, deviceMode, hasGeneratedOnce, sidebarOpen, isRestored, storageKey])

  useEffect(() => {
    if (previewHtmlContent && viewMode !== "preview") {
      setPreviewHtmlContent(null)
    }
  }, [previewHtmlContent, viewMode])

  useEffect(() => {
    if (!versionHistoryOpen && previewHtmlContent) {
      setPreviewHtmlContent(null)
    }
  }, [previewHtmlContent, versionHistoryOpen])

  // Auto-save to MongoDB when content changes (debounced)
  useEffect(() => {
    if (!isRestored || isLoadingProject) return
    if (!projectId || projectId === "new") return
    if (!hasUnsavedChanges) return
    
    debouncedSave(htmlContent)
  }, [htmlContent, hasUnsavedChanges, isRestored, isLoadingProject, projectId, debouncedSave])

  // Load default preview template (Cinematheque) once on mount.
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(CINEMATHEQUE_TEMPLATE_ENDPOINT)
        if (!res.ok) return
        const templateHtml = await res.text()
        if (cancelled) return

        setHtmlContent((current) =>
          current.includes("CINEMATHEQUE_TEMPLATE_LOADING") ? templateHtml : current
        )
      } catch {
        // Keep LOADING_HTML on failure.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const isCompleteHtmlDocument = useCallback((value: string): boolean => {
    if (!value) return false
    const normalized = value.trim()
    const hasRoot = normalized.includes("<!DOCTYPE") || normalized.includes("<html")
    return hasRoot && normalized.includes("</html>")
  }, [])

  const finalizeAssistantMessage = useCallback(
    (content: string) => {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === "assistant") {
          saveMessageToMongo({
            role: "assistant",
            content,
            thinkingContent: lastMessage.thinkingContent,
          })

          return prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, isThinking: false, content }
              : m
          )
        }
        return prev
      })
    },
    [saveMessageToMongo]
  )

  const finalizeGenerationSuccess = useCallback(() => {
    setDraftAiOutput("")
    setApplyingPatch(false)
    setViewMode("preview")
    setHasGeneratedOnce(true)
    finalizeAssistantMessage("Built. Code updated in the editor.")

    if (htmlContentRef.current) {
      createCheckpoint("AI-generated update", {
        silent: true,
        kind: "auto",
        trigger: "after-ai",
      })
    }
  }, [createCheckpoint, finalizeAssistantMessage, setApplyingPatch])

  const {
    sendMessage: sendAIMessage,
    cancel: cancelAI,
    isGenerating,
  } = useAIChat({
    onContentUpdate: (content) => {
      // Stream output into Monaco (not into chat)
      setDraftAiOutput(content)
    },
    onThinkingUpdate: (thinkingContent) => {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, thinkingContent, isThinking: true } : m
          )
        }
        return prev
      })
    },
    onProjectNameUpdate: (name) => {
      const normalizedName = normalizeProjectName(name)
      setProjectName(normalizedName)
      saveProjectToMongo(htmlContentRef.current, normalizedName)
    },
    onPatch: (filePath, search, replace) => {
      const normalizedPath = filePath.trim().replace(/^\.?\//, "")
      if (normalizedPath !== "index.html") {
        console.warn(`Unsupported patch target: ${filePath}`)
        return false
      }

      // Use the ref for synchronous access to current HTML
      const parser = new StreamParser({})
      const result = parser.applyPatch(htmlContentRef.current, search, replace, filePath)
      
      if (result.success) {
        htmlContentRef.current = result.content
        setHtmlContent(result.content)
        setHasUnsavedChanges(true)
        return true
      } else {
        console.warn(`Patch failed for ${filePath}: ${result.error}`)
        return false
      }
    },
    onComplete: ({ extractedHtml, failedFiles, recoveryMode, incompletePatches, validationError }) => {
      const isFollowUp = hasGeneratedOnce
      const hasPatchFailures = !!failedFiles?.length
      const hasCompleteHtml = isCompleteHtmlDocument(extractedHtml)
      const hasProtocolIssues = Boolean(validationError) || (incompletePatches || 0) > 0
      const shouldRecover = (hasPatchFailures || hasProtocolIssues) && !hasCompleteHtml

      if (shouldRecover && !recoveryMode) {
        const failedFileSummary = (failedFiles || []).join(", ") || "index.html"
        const originalPrompt = lastUserPromptRef.current || "the requested changes"
        const recoveryReason = validationError
          ? validationError
          : incompletePatches
            ? `Received ${incompletePatches} incomplete patch block${incompletePatches > 1 ? "s" : ""}`
            : `Patch update failed for ${failedFileSummary}`

        setPendingRecovery({
          prompt: originalPrompt,
          failedFiles: failedFiles || [],
          model: state.selectedModel,
        })

        toast({
          title: "Recovering update",
          description: `${recoveryReason}. Applying a full-document recovery update...`,
        })

        setDraftAiOutput("")
        setViewMode("code")
        return
      }

      if (shouldRecover && recoveryMode) {
        recoveryInFlightRef.current = false
        setPendingRecovery(null)
        setDraftAiOutput("")
        setApplyingPatch(false)
        setViewMode("preview")
        toast({
          title: "Recovery failed",
          description: "Could not recover the update automatically. Try a smaller, more specific follow-up request.",
          variant: "destructive",
        })
        finalizeAssistantMessage("Could not recover the update automatically. Try a smaller, more specific follow-up request.")
        return
      }

      if (hasCompleteHtml) {
        setHtmlContent(extractedHtml)
        htmlContentRef.current = extractedHtml
        setHasUnsavedChanges(true)

        if (hasPatchFailures) {
          toast({
            title: "Update applied",
            description: "Applied a full-document update to keep the editor in sync.",
          })
        }
      } else {
        // If it was a follow-up, patches were applied in real-time via onPatch.
        // If it was the first generation, or if the AI decided to send full content anyway
        if ((!isFollowUp || extractedHtml) && extractedHtml && (extractedHtml.includes("<!DOCTYPE") || extractedHtml.includes("<html"))) {
          setHtmlContent(extractedHtml)
          htmlContentRef.current = extractedHtml
          setHasUnsavedChanges(true)
        }
      }

      recoveryInFlightRef.current = false
      setPendingRecovery(null)
      finalizeGenerationSuccess()
    },
    onError: (error) => {
      const isRecoveryFailure = recoveryInFlightRef.current
      recoveryInFlightRef.current = false
      setPendingRecovery(null)
      setDraftAiOutput("")
      setApplyingPatch(false)
      setViewMode("preview")
      toast({
        title: isRecoveryFailure ? "Recovery failed" : "Generation failed",
        description: isRecoveryFailure
          ? "Could not recover the update automatically. Try a smaller, more specific follow-up request."
          : error.message || "Something went wrong while generating code. Please try again.",
        variant: "destructive",
      })
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === "assistant") {
          const finalContent = isRecoveryFailure
            ? "Could not recover the update automatically. Try a smaller, more specific follow-up request."
            : `Error: ${error.message}`

          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, isThinking: false, content: finalContent } : m
          )
        }
        return prev
      })
    },
  })

  useEffect(() => {
    if (!pendingRecovery || isGenerating) return

    recoveryInFlightRef.current = true
    const recoveryRequest = pendingRecovery
    setPendingRecovery(null)

    setApplyingPatch(true)
    setViewMode("code")
    setDraftAiOutput("")

    void sendAIMessage({
      prompt: recoveryRequest.prompt,
      currentHtml: htmlContentRef.current,
      selectedElement: undefined,
      isFollowUp: true,
      recoveryMode: "full-document",
      model: recoveryRequest.model ?? state.selectedModel,
      enhancedPrompts: state.enhancedPrompts,
      primaryColor: state.primaryColor,
      secondaryColor: state.secondaryColor,
      theme: state.theme,
    }).catch(() => {
      // Error handling is managed by useAIChat onError callback.
    })
  }, [
    isGenerating,
    pendingRecovery,
    sendAIMessage,
    setApplyingPatch,
    state.enhancedPrompts,
    state.selectedModel,
    state.primaryColor,
    state.secondaryColor,
    state.theme,
  ])

  // Handle sending a message
  const handleSend = useCallback(
    async (message: string, model?: string) => {
      if (!message.trim()) return

      recoveryInFlightRef.current = false
      setPendingRecovery(null)

      if (isGenerating) {
        cancelAI()
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      if (!session) {
        showSignIn()
        return
      }

      const isFollowUp = messages.length > 0
      const shouldApplyFallbackName = !isFollowUp && isDefaultProjectName(projectName)
      if (shouldApplyFallbackName) {
        const fallbackName = deriveProjectNameFromPrompt(message)
        if (!isDefaultProjectName(fallbackName)) {
          setProjectName(fallbackName)
          saveProjectToMongo(htmlContentRef.current, fallbackName)
        }
      }

      await createCheckpoint(`Before AI: ${message.slice(0, 120)}`, {
        silent: true,
        kind: "auto",
        trigger: "before-ai",
      })

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        content: message,
        role: "user",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])
      
      // Save user message to MongoDB
      saveMessageToMongo({ role: "user", content: message })
      lastUserPromptRef.current = message

      // Show generation in Monaco
      setViewMode("code")
      setDraftAiOutput("")

      // Add placeholder assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "",
        role: "assistant",
        timestamp: new Date(),
        isThinking: true,
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Send to AI
      setApplyingPatch(true)
      const conversationHistory = messages
        .filter((entry) => entry.content.trim().length > 0)
        .slice(-6)
        .map((entry) => ({
          role: entry.role,
          content: entry.content.trim(),
        }))
      
      let selectedElementHtml = undefined
      if (isFollowUp && selectedElement) {
        try {
          const parser = new DOMParser()
          const doc = parser.parseFromString(htmlContentRef.current, "text/html")
          const element = doc.querySelector(selectedElement.id)
          if (element) {
            selectedElementHtml = element.outerHTML
          } else {
            setSelectedElement(null)
            toast({
              title: "Selected element unavailable",
              description: "The previously selected element no longer exists in the current HTML. Applying the request globally instead.",
            })
          }
        } catch (e) {
          console.error("Failed to extract selected element HTML", e)
        }
      }

      try {
        await sendAIMessage({
          prompt: message,
          currentHtml: isFollowUp ? htmlContentRef.current : undefined,
          selectedElement: selectedElementHtml,
          isFollowUp,
          model: model ?? state.selectedModel,
          enhancedPrompts: state.enhancedPrompts,
          primaryColor: state.primaryColor,
          secondaryColor: state.secondaryColor,
          theme: state.theme,
          conversationHistory,
        })
      } catch {
        // Error handling is managed by useAIChat onError callback.
      }
    },
    [
      session,
      showSignIn,
      createCheckpoint,
      sendAIMessage,
      cancelAI,
      isGenerating,
      messages.length,
      messages,
      selectedElement,
      state.enhancedPrompts,
      state.selectedModel,
      state.primaryColor,
      state.secondaryColor,
      state.theme,
      projectName,
    ]
  )

  // Handle random prompt
  const handleRandomPrompt = useCallback(() => {
    const randomPrompt = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)]
    return randomPrompt
  }, [])

  // Handle initial prompt from landing page
  useEffect(() => {
    // Only send initial prompt if:
    // 1. State restoration is complete
    // 2. We have an initial prompt
    // 3. We haven't processed it yet
    // 4. There are no existing messages (meaning this is a fresh start, not a refresh)
    if (isRestored && initialPrompt && !hasProcessedInitialPrompt.current && messages.length === 0) {
      hasProcessedInitialPrompt.current = true
      handleSend(initialPrompt, initialModel)
    }
  }, [isRestored, initialPrompt, initialModel, messages.length]) // Depend on isRestored

  // Handle code editor changes
  const handleCodeChange = useCallback((value: string) => {
    setHtmlContent(value)
    setHasUnsavedChanges(true)
  }, [])

  // Handle reset chat
  const handleResetChat = useCallback(async () => {
    if (!window.confirm("Are you sure you want to clear the chat history? This cannot be undone.")) {
      return
    }

    setMessages([])
    
    if (projectId && projectId !== "new" && session?.user?.id) {
      try {
        await fetch(`/api/projects/${projectId}/messages`, {
          method: "DELETE",
        })
        toast({ title: "Chat history cleared" })
      } catch (error) {
        console.error("Failed to clear chat history:", error)
        toast({ title: "Failed to clear chat history", variant: "destructive" })
      }
    }
  }, [projectId, session?.user?.id, toast])

  const handleUploadMedia = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !projectId || projectId === "new" || !session?.user?.id) {
      return
    }

    setIsUploadingMedia(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/projects/${projectId}/media`, {
        method: "POST",
        body: formData,
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || "Failed to upload media")
      }

      toast({
        title: "Media uploaded",
        description: `${file.name} is now available in this project.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload media"
      toast({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsUploadingMedia(false)
      if (event.target) {
        event.target.value = ""
      }
    }
  }, [projectId, session?.user?.id, toast])

  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const handleExport = useCallback(() => {
    setIsExportModalOpen(true)
  }, [])

  const handleConfirmExport = useCallback(() => {
    const safeFileName = sanitizeFileName(projectName)

    try {
      if (exportFormat === "html") {
        downloadFile(htmlContent, `${safeFileName}.html`, "text/html")
      } else {
        const reactComponent = convertHtmlToReactComponent(htmlContent, projectName)
        downloadFile(reactComponent, `${safeFileName}.tsx`, "text/plain")
      }

      toast({
        title: "Export complete",
        description: exportFormat === "react" ? "Downloaded React component (.tsx)." : "Downloaded HTML file.",
      })
      setIsExportModalOpen(false)
    } catch (error) {
      console.error("Export failed:", error)
      toast({
        title: "Export failed",
        description: "Unable to export the current project.",
        variant: "destructive",
      })
    }
  }, [downloadFile, exportFormat, htmlContent, projectName, toast])

  const handleSaveCheckpoint = useCallback(async () => {
    const description = viewMode === "design"
      ? "Manual checkpoint (design mode)"
      : "Manual checkpoint"

    await createCheckpoint(description, {
      kind: "manual",
      trigger: "manual-save",
    })
  }, [createCheckpoint, viewMode])

  const handlePreviewVersion = useCallback((version: HistoryVersion | null) => {
    if (!version) {
      setPreviewHtmlContent(null)
      return
    }

    setPreviewHtmlContent(version.htmlContent)
    setViewMode("preview")
  }, [])

  const handleRestoreVersion = useCallback(async (version: HistoryVersion) => {
    if (!version || !version.htmlContent) {
      toast({
        title: "Restore failed",
        description: "Selected version could not be restored.",
        variant: "destructive",
      })
      return false
    }

    const targetVersionId = coerceVersionId(version.id)

    setHtmlContent(version.htmlContent)
    htmlContentRef.current = version.htmlContent
    setCurrentVersionId(targetVersionId)
    setHasUnsavedChanges(true)
    setPreviewHtmlContent(null)
    setViewMode("preview")

    toast({
      title: "Version restored",
      description: version.description || "Reverted to selected checkpoint.",
    })

    await createCheckpoint("Restored checkpoint", {
      silent: true,
      kind: "restore",
      trigger: "restore",
      restoredFromId: MONGO_OBJECT_ID_REGEX.test(targetVersionId) ? targetVersionId : undefined,
    })
    return true
  }, [createCheckpoint, toast, versions])

  const handleElementSelect = useCallback((info: SelectedElementInfo) => {
    setSelectedElement({
      id: info.selector,
      type: info.type,
      styles: info.styles,
      properties: info.properties,
      clickPosition: info.clickPosition
    })
    setPanelPosition(info.clickPosition)
  }, [])

  // Calculate panel position to keep it within viewport
  const calculatePanelPosition = useCallback((clickPos: { x: number; y: number }) => {
    const panelWidth = 288 + 16 // w-72 + padding
    const panelHeight = 480 + 16 // max-h-[480px] + padding
    const offset = 12
    const sidebarWidth = sidebarOpen ? 380 : 0
    
    // Get available viewport area (accounting for sidebar)
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    let left = clickPos.x + offset
    let top = clickPos.y
    
    // Check right edge - if panel would overflow, position to left of cursor
    if (left + panelWidth > viewportWidth) {
      left = Math.max(sidebarWidth + 8, clickPos.x - panelWidth - offset)
    }
    
    // Ensure left doesn't go behind sidebar
    left = Math.max(sidebarWidth + 8, left)
    
    // Check bottom edge - if panel would overflow, position above cursor
    if (top + panelHeight > viewportHeight) {
      top = Math.max(60, viewportHeight - panelHeight - 8) // 60 for top nav
    }
    
    // Ensure top doesn't go above viewport (accounting for top nav)
    top = Math.max(60, top)
    
    return { left, top }
  }, [sidebarOpen])

  const handleClosePanel = useCallback(() => {
    setSelectedElement(null)
    setPanelPosition(null)
  }, [])

  const handleLiveStyleChange = useCallback((property: string, value: StyleProperty) => {
    if (!selectedElement) return

    // Update local state for inputs
    setSelectedElement(prev => prev ? ({
      ...prev,
      styles: { ...prev.styles, [property]: value }
    }) : null)

    // Direct DOM update
    applyChangeToIframe(selectedElement.id, property, value)
  }, [applyChangeToIframe, selectedElement])

  // Apply style to DOM and update HTML
  const applyStyleToDOM = useCallback((
    selector: string, 
    property: string, 
    value: StyleProperty,
    recordHistory: boolean = true
  ) => {
    try {
      const baseHtml = htmlContentRef.current || htmlContent
      const parser = new DOMParser()
      const doc = parser.parseFromString(baseHtml, "text/html")
      const element = doc.querySelector(selector)
      
      if (element) {
        const htmlElement = element as HTMLElement
        const oldValue = htmlElement.style[property as any] || ''
        
        // Apply the style
        htmlElement.style[property as any] = value.toString()
        
        const newHtml = doc.documentElement.outerHTML
        isStyleUpdate.current = true
        setHtmlContent(newHtml)
        lastAppliedHtml.current = newHtml
        setHasUnsavedChanges(true)
        
        // Record in history if needed
        if (recordHistory) {
          const styleChange: StyleChange = {
            id: Date.now().toString(),
            selector,
            property,
            oldValue,
            newValue: value,
            timestamp: Date.now(),
          }
          styleHistoryActions.pushChange(styleChange)
        }
        
        return true
      }
    } catch (e) {
      console.error("Failed to update style", e)
    }
    return false
  }, [htmlContent, styleHistoryActions])

  // Reset style update flag after render
  useEffect(() => {
    isStyleUpdate.current = false
  })

  const handleStyleChange = useCallback((property: string, value: StyleProperty, validated?: boolean) => {
    if (!selectedElement) return

    // Update local state immediately for responsive UI
    setSelectedElement(prev => prev ? ({
      ...prev,
      styles: { ...prev.styles, [property]: value }
    }) : null)

    // Apply to DOM
    applyStyleToDOM(selectedElement.id, property, value, validated === true)
  }, [selectedElement, applyStyleToDOM])

  const handleTextChange = useCallback((selector: string, text: string) => {
    try {
      const baseHtml = htmlContentRef.current || htmlContent
      const parser = new DOMParser()
      const doc = parser.parseFromString(baseHtml, "text/html")
      const element = doc.querySelector(selector)
      if (!element) return

      const oldText = element.textContent ?? ""
      if (oldText === text) return

      element.textContent = text

      const newHtml = doc.documentElement.outerHTML
      isStyleUpdate.current = true
      setHtmlContent(newHtml)
      setHasUnsavedChanges(true)

      const textChange: StyleChange = {
        id: Date.now().toString(),
        selector,
        property: TEXT_CONTENT_PROPERTY,
        oldValue: oldText,
        newValue: text,
        timestamp: Date.now(),
      }
      styleHistoryActions.pushChange(textChange)

      if (selectedElement?.id === selector) {
        setSelectedElement((prev) => prev ? {
          ...prev,
          properties: {
            ...prev.properties,
            textContent: text,
          },
        } : null)
      }
    } catch (e) {
      console.error("Failed to update text", e)
    }
  }, [htmlContent, selectedElement, styleHistoryActions])

  // Undo handler
  const handleUndo = useCallback(() => {
    const undoneChanges = styleHistoryActions.undo()
    if (!undoneChanges || undoneChanges.length === 0) return
    
    // Apply the old values
    try {
      const baseHtml = htmlContentRef.current || htmlContent
      const parser = new DOMParser()
      const doc = parser.parseFromString(baseHtml, "text/html")
      
      for (const change of undoneChanges) {
        const element = doc.querySelector(change.selector)
        if (element) {
          if (change.property === TEXT_CONTENT_PROPERTY) {
            element.textContent = change.oldValue?.toString() ?? ""
          } else {
            (element as HTMLElement).style[change.property as any] = change.oldValue.toString()
          }
        }
      }
      
      const newHtml = doc.documentElement.outerHTML
      isStyleUpdate.current = true
      setHtmlContent(newHtml)
      setHasUnsavedChanges(true)

      // Apply to iframe for immediate UI update
      for (const change of undoneChanges) {
        const value = change.oldValue
        applyChangeToIframe(change.selector, change.property, value)
      }
      
      // Update selected element styles
      if (selectedElement) {
        const updatedStyles = { ...selectedElement.styles }
        const updatedProperties = { ...selectedElement.properties }
        for (const change of undoneChanges) {
          if (change.selector === selectedElement.id) {
            if (change.property === TEXT_CONTENT_PROPERTY) {
              updatedProperties.textContent = change.oldValue?.toString() ?? ""
            } else {
              updatedStyles[change.property] = change.oldValue
            }
          }
        }
        setSelectedElement(prev => prev ? { ...prev, styles: updatedStyles, properties: updatedProperties } : null)
      }
    } catch (e) {
      console.error("Failed to undo", e)
    }
  }, [applyChangeToIframe, styleHistoryActions, htmlContent, selectedElement])

  // Redo handler
  const handleRedo = useCallback(() => {
    const redoneChanges = styleHistoryActions.redo()
    if (!redoneChanges || redoneChanges.length === 0) return
    
    // Apply the new values
    try {
      const baseHtml = htmlContentRef.current || htmlContent
      const parser = new DOMParser()
      const doc = parser.parseFromString(baseHtml, "text/html")
      
      for (const change of redoneChanges) {
        const element = doc.querySelector(change.selector)
        if (element) {
          if (change.property === TEXT_CONTENT_PROPERTY) {
            element.textContent = change.newValue?.toString() ?? ""
          } else {
            (element as HTMLElement).style[change.property as any] = change.newValue.toString()
          }
        }
      }
      
      const newHtml = doc.documentElement.outerHTML
      isStyleUpdate.current = true
      setHtmlContent(newHtml)
      setHasUnsavedChanges(true)

      // Apply to iframe for immediate UI update
      for (const change of redoneChanges) {
        const value = change.newValue
        applyChangeToIframe(change.selector, change.property, value)
      }
      
      // Update selected element styles
      if (selectedElement) {
        const updatedStyles = { ...selectedElement.styles }
        const updatedProperties = { ...selectedElement.properties }
        for (const change of redoneChanges) {
          if (change.selector === selectedElement.id) {
            if (change.property === TEXT_CONTENT_PROPERTY) {
              updatedProperties.textContent = change.newValue?.toString() ?? ""
            } else {
              updatedStyles[change.property] = change.newValue
            }
          }
        }
        setSelectedElement(prev => prev ? { ...prev, styles: updatedStyles, properties: updatedProperties } : null)
      }
    } catch (e) {
      console.error("Failed to redo", e)
    }
  }, [applyChangeToIframe, styleHistoryActions, htmlContent, selectedElement])

  const handleElementChange = useCallback((element: SelectedElement) => {
    if (!selectedElement) return
    
    setSelectedElement(element)

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, "text/html")
      const domElement = doc.querySelector(selectedElement.id)
      
      if (domElement) {
        if (element.properties?.id) domElement.id = element.properties.id
        if (element.properties?.className) domElement.className = element.properties.className
        
        setHtmlContent(doc.documentElement.outerHTML)
        setHasUnsavedChanges(true)
      }
    } catch (e) {
      console.error("Failed to update element properties", e)
    }
  }, [htmlContent, selectedElement])

  // Render content based on view mode
  const renderContent = () => {
    switch (viewMode) {
      case "preview":
        return (
          <PreviewFrame
            htmlContent={previewHtmlContent ?? htmlContent}
            deviceMode={deviceMode}
            className="h-full"
            forwardedRef={previewRef}
            isStyleUpdate={isStyleUpdate.current}
          />
        )
      case "design":
        const panelPos = panelPosition ? calculatePanelPosition(panelPosition) : null
        return (
          <div className="flex h-full relative overflow-hidden">
            <PreviewFrame
              htmlContent={htmlContent}
              deviceMode={deviceMode}
              className="flex-1"
              isDesignMode
              onElementSelect={handleElementSelect}
              onTextChange={handleTextChange}
              forwardedRef={previewRef}
              isStyleUpdate={isStyleUpdate.current}
            />
            {selectedElement && panelPos && (
              <div 
                className="fixed z-50"
                style={{
                  left: panelPos.left,
                  top: panelPos.top,
                }}
              >
                <StylePanel
                  selectedElement={selectedElement}
                  onStyleChange={handleStyleChange}
                  onLiveStyleChange={handleLiveStyleChange}
                  onElementChange={handleElementChange}
                  onClose={handleClosePanel}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={styleHistoryActions.canUndo}
                  canRedo={styleHistoryActions.canRedo}
                />
              </div>
            )}
          </div>
        )
      case "code":
        const isSurgical = draftAiOutput.includes("<<<<<<< SEARCH") || 
                          draftAiOutput.includes("<<<<<<< UPDATE_FILE") ||
                          draftAiOutput.includes("<<<<<<< PROJECT_NAME") ||
                          draftAiOutput.includes("<<<<<<< NEW_FILE");
        return (
          <CodeEditor
            value={isGenerating && !isSurgical ? (draftAiOutput || htmlContent) : htmlContent}
            onChange={handleCodeChange}
            readOnly={isGenerating}
            className="h-full"
          />
        )
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[380px]",
          "flex flex-col bg-[#0a0a0a]",
          "transition-transform duration-200 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-10 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="group p-1 rounded-md flex items-center justify-center relative"
              onClick={() => {
                if (onBack) {
                  onBack()
                } else {
                  router.push("/dashboard")
                }
              }}
            >
              <img
                src="/Codeui.svg"
                alt="CodeUI"
                className="h-7 w-auto group-hover:opacity-0 transition-opacity"
              />
              <ChevronLeft className="absolute w-5 h-5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="bg-transparent text-sm font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-700 rounded px-1 -ml-1"
              />
              {hasUnsavedChanges && (
                <span className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />
              )}
            </div>
          </div>
          
          <button
            onClick={handleResetChat}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors"
            title="Reset Chat"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="mb-2 flex items-center justify-center">
                <SolarCodeSquareLinear className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-200 mb-2">
                Start Building
              </h3>
              <p className="text-sm text-zinc-500 mb-6 max-w-[280px]">
                Describe the website you want to create. Be as detailed as you like!
              </p>
              <div className="space-y-2 w-full">
                {EXAMPLE_PROMPTS.slice(0, 3).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt)}
                    className="w-full text-left text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 rounded-lg px-3 py-2 transition-colors"
                  >
                    {prompt.slice(0, 60)}...
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  <div
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-xl px-4 py-2.5 max-w-[90%]",
                        message.role === "user"
                          ? "bg-[#27272A] text-zinc-100"
                          : "bg-transparent text-zinc-100"
                      )}
                    >
                      {message.role === "assistant" && message.isThinking && !message.content ? (
                        <div className="flex items-center gap-2">
                          <TextShimmer className="font-mono text-sm" duration={1}>
                            Generating code...
                          </TextShimmer>
                          <button
                            onClick={cancelAI}
                            aria-label="Cancel generation"
                            className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )} 
                    </div>
                  </div>
                  
                  {/* Thinking panel for assistant */}
                  {message.role === "assistant" && message.thinkingContent && (
                    <div className="ml-2">
                      <button
                        onClick={() => setThinkingExpanded(!thinkingExpanded)}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                      >
                        {thinkingExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        Thinking
                      </button>
                      {thinkingExpanded && (
                        <div className="mt-2 p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                          <p className="text-xs text-zinc-500 whitespace-pre-wrap">
                            {message.thinkingContent}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>



        {/* Chat Input */}
        <div className="p-4 border-t border-zinc-800">
          <AI_Prompt 
            onSend={handleSend}
            onFileSelect={handleUploadMedia}
            fileUploadAccept="image/*,video/*,audio/*"
            isFileUploadDisabled={isUploadingMedia || !session?.user?.id || !projectId || projectId === "new"}
            initialModelId={state.selectedModel}
            onModelChange={setModel}
            availableModels={state.availableModels}
            isLoadingModels={state.isLoadingModels}
          />
        </div>
      </div>

      {/* Main Content */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-200",
          sidebarOpen ? "lg:ml-[380px]" : ""
        )}
      >
        <TopNav
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          deviceMode={deviceMode}
          onDeviceModeChange={setDeviceMode}
          onExport={handleExport}
          onSave={handleSaveCheckpoint}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={styleHistoryActions.canUndo}
          canRedo={styleHistoryActions.canRedo}
          onHistoryOpen={() => setVersionHistoryOpen(true)}
          isGenerating={isGenerating}
          hasUnsavedChanges={hasUnsavedChanges}
          primaryColor={state.primaryColor}
          secondaryColor={state.secondaryColor}
          theme={state.theme}
          enhancedPrompts={state.enhancedPrompts}
          onPrimaryColorChange={setPrimaryColor}
          onSecondaryColorChange={setSecondaryColor}
          onThemeChange={setTheme}
          onEnhancedPromptsChange={setEnhancedPrompts}
        />

        <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
            <DialogHeader>
              <DialogTitle>Export project</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Choose a format for your download.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <button
                onClick={() => setExportFormat("html")}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  exportFormat === "html"
                    ? "border-zinc-500 bg-zinc-900"
                    : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
                )}
              >
                <p className="text-sm font-medium text-zinc-100">HTML</p>
                <p className="text-xs text-zinc-400 mt-1">Downloads the complete current HTML document.</p>
              </button>

              <button
                onClick={() => setExportFormat("react")}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  exportFormat === "react"
                    ? "border-zinc-500 bg-zinc-900"
                    : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
                )}
              >
                <p className="text-sm font-medium text-zinc-100">React (.tsx)</p>
                <p className="text-xs text-zinc-400 mt-1">Best-effort JSX conversion from your current HTML and styles.</p>
              </button>
            </div>

            <DialogFooter>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="h-9 px-3 rounded-md border border-zinc-800 text-zinc-300 hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExport}
                className="h-9 px-3 rounded-md bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-colors"
              >
                Export {exportFormat === "react" ? "TSX" : "HTML"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <VersionHistory
          versions={versions}
          currentVersionId={currentVersionId}
          onRestore={handleRestoreVersion}
          onPreview={handlePreviewVersion}
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
          trigger={null}
        />

        {/* Canvas/Editor Area */}
        <div className="flex-1 overflow-hidden bg-zinc-900">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
