"use client"

import { useEffect, useState, useCallback } from "react"
import { TopNav } from "@/components/top-nav-new"
import { AI_Prompt } from "@/components/ui/animated-ai-input"
import { PreviewFrame, type SelectedElementInfo } from "@/components/preview-frame"
import { CodeEditor } from "@/components/code-editor"
import { StylePanel, type SelectedElement, type StyleProperty } from "@/components/style-panel"
import { TextShimmer } from "@/components/ui/text-shimmer";
import { ChevronDown, ChevronLeft, X, ChevronUp } from "lucide-react"
import { SolarCodeSquareLinear } from "@/components/solar-code-square-linear"
import { useSession } from "next-auth/react"
import { useAuthDialog } from "@/components/auth-dialog-provider"
import { useAIChat, applySearchReplace } from "@/hooks/use-ai-chat"
import { cn } from "@/lib/utils"

type ViewMode = "preview" | "design" | "code"
type DeviceMode = "desktop" | "tablet" | "mobile"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  isThinking?: boolean
  thinkingContent?: string
}

const CINEMATHEQUE_TEMPLATE_ENDPOINT = "/api/templates/cinematheque-preview"
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

export function EditorLayoutNew() {
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("preview")
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop")
  const [draftAiOutput, setDraftAiOutput] = useState("")
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false)
  
  // Project State
  const [projectName, setProjectName] = useState("untitled-project")
  const [htmlContent, setHtmlContent] = useState(LOADING_HTML)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null)
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([])
  const [thinkingExpanded, setThinkingExpanded] = useState(true)
  
  // Auth
  const { data: session } = useSession()
  const { showSignIn } = useAuthDialog()

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

  // AI Chat Hook
  const {
    sendMessage: sendAIMessage,
    cancel: cancelAI,
    isGenerating,
    thinking,
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
    onComplete: ({ rawContent, extractedHtml }) => {
      const isFollowUp = hasGeneratedOnce

      const newHtml = isFollowUp
        ? applySearchReplace(htmlContent, rawContent)
        : extractedHtml

      if (newHtml.includes("<!DOCTYPE") || newHtml.includes("<html")) {
        setHtmlContent(newHtml)
        setHasUnsavedChanges(true)
        setHasGeneratedOnce(true)
      }

      setDraftAiOutput("")

      // Mark thinking as complete + leave a short status in chat
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, isThinking: false, content: "Built. Code updated in the editor." }
              : m
          )
        }
        return prev
      })
    },
    onError: (error) => {
      setDraftAiOutput("")
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: `Error: ${error.message}` } : m
          )
        }
        return prev
      })
    },
  })

  // Handle sending a message
  const handleSend = useCallback(
    async (message: string, model?: string) => {
      if (!message.trim()) return

      if (!session) {
        showSignIn()
        return
      }

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        content: message,
        role: "user",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])

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
      const isFollowUp = messages.length > 0
      await sendAIMessage({
        prompt: message,
        currentHtml: isFollowUp ? htmlContent : undefined,
        isFollowUp,
        model,
      })
    },
    [session, showSignIn, sendAIMessage, htmlContent, messages.length]
  )

  // Handle random prompt
  const handleRandomPrompt = useCallback(() => {
    const randomPrompt = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)]
    return randomPrompt
  }, [])

  // Handle code editor changes
  const handleCodeChange = useCallback((value: string) => {
    setHtmlContent(value)
    setHasUnsavedChanges(true)
  }, [])

  // Handle export/download
  const handleExport = useCallback(() => {
    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${projectName}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [htmlContent, projectName])

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

  const handleStyleChange = useCallback((property: string, value: StyleProperty) => {
    if (!selectedElement) return

    // Update local state immediately
    setSelectedElement(prev => prev ? ({
      ...prev,
      styles: { ...prev.styles, [property]: value }
    }) : null)

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, "text/html")
      const element = doc.querySelector(selectedElement.id)
      
      if (element) {
        (element as HTMLElement).style[property as any] = value.toString()
        setHtmlContent(doc.documentElement.outerHTML)
        setHasUnsavedChanges(true)
      }
    } catch (e) {
      console.error("Failed to update style", e)
    }
  }, [htmlContent, selectedElement])

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
            htmlContent={htmlContent}
            deviceMode={deviceMode}
            className="h-full"
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
                  onElementChange={handleElementChange}
                  onClose={handleClosePanel}
                />
              </div>
            )}
          </div>
        )
      case "code":
        return (
          <CodeEditor
            value={isGenerating ? (draftAiOutput || htmlContent) : htmlContent}
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
              onClick={() => window.location.href = "/"}
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
        <div className="p-4">
          <AI_Prompt onSend={handleSend} />
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
          isGenerating={isGenerating}
        />

        {/* Canvas/Editor Area */}
        <div className="flex-1 overflow-hidden bg-zinc-900">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
