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
  Image as ImageIcon,
  Figma,
  Upload,
  LayoutTemplate,
  ArrowLeft,
  Sparkles,
  Bot,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  FolderOpen
} from "lucide-react"
import { useState, useRef, useCallback, useEffect } from "react"
import { UserMenu } from "@/components/user-menu"
import { FeedbackModal } from "@/components/feedback-modal"
import { PricingModal } from "@/components/pricing-modal"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession } from "next-auth/react"

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
}

export function DashboardMain({ onStart }: DashboardMainProps) {
  const { data: session } = useSession()
  const [view, setView] = useState<'dashboard' | 'projects'>('dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [selectedModelId, setSelectedModelId] = useState<string>("google/gemini-3-flash-preview")
  const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string}>>([])
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  const [promptValue, setPromptValue] = useState("")
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [isPricingOpen, setIsPricingOpen] = useState(false)
  
  // Projects state
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [recentChats, setRecentChats] = useState<string[]>([])
  
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
          // Extract recent chat titles from project names
          const chatTitles = data.projects.slice(0, 15).map((p: Project) => p.name)
          setRecentChats(chatTitles)
        }
      })
      .catch(err => {
        console.error('Failed to fetch projects:', err)
      })
      .finally(() => {
        setIsLoadingProjects(false)
      })
  }, [session?.user])

  // Fetch available models on mount
  useEffect(() => {
    fetch('/api/ai/models')
      .then(res => res.json())
      .then(data => {
        if (data.models && Array.isArray(data.models)) {
          setAvailableModels(data.models.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })))
          // Use default model if available, otherwise first one
          const defaultModel = data.models.find((m: { id: string }) => m.id === "google/gemini-3-flash-preview")
          if (defaultModel) {
            setSelectedModelId(defaultModel.id)
          } else if (data.models.length > 0) {
            setSelectedModelId(data.models[0].id)
          }
        }
      })
      .catch(err => {
        console.error('Failed to fetch models:', err)
        // Fallback to default models if API fails
        setAvailableModels([
          { id: "google/gemini-3-flash-preview", name: "CODEUI GOD MODE" },
          { id: "deepseek/deepseek-chat", name: "DeepSeek V3" },
          { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
        ])
      })
      .finally(() => {
        setIsLoadingModels(false)
      })
  }, [])

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

  const handleSend = () => {
    if (!promptValue.trim()) return
    onStart(promptValue.trim(), selectedModelId)
  }

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

  // Get user credits from session
  const userCredits = (session?.user as { credits?: number })?.credits ?? 10
  const maxCredits = 500 // Could be based on subscription tier

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans selection:bg-white/20">
      {/* Sidebar */}
      <aside 
        className={`
          flex-shrink-0 flex flex-col border-r border-white/10 bg-black transition-all duration-300 ease-in-out overflow-hidden
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
            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium ml-1">Free</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarOpen(false)}
            className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-900"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>

        {/* New Chat Button */}
        <div className="px-4 mb-4">
          <Button 
            onClick={() => onStart()}
            variant="outline" 
            className="w-full justify-start gap-2 bg-transparent border-white/10 text-zinc-300 hover:bg-zinc-900 hover:text-white h-9"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">New Chat</span>
          </Button>
        </div>

        {/* Navigation Items */}
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1">
            <SidebarItem icon={<Search className="w-4 h-4" />} label="Search" />
          </div>

          <div className="mt-6 space-y-4">
            <div className="px-2">
              <div className="flex items-center justify-between text-zinc-500 hover:text-zinc-300 cursor-pointer group mb-1">
                <span className="text-xs font-medium">Favorites</span>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                ) : recentChats.length > 0 ? (
                  recentChats.map((chat, i) => (
                    <div key={i} className="px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 rounded-md cursor-pointer truncate transition-colors">
                      {chat}
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-3 text-xs text-zinc-500 text-center">
                    No projects yet. Start creating!
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
                    <span className="text-xs font-medium text-zinc-400">Credits</span>
                    <span className="text-xs font-bold text-zinc-200">{userCredits} / {maxCredits}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all" 
                      style={{ width: `${Math.min((userCredits / maxCredits) * 100, 100)}%` }}
                    />
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">
                     You&apos;re using {Math.round((userCredits / maxCredits) * 100)}% of your credits.
                 </p>
                 <Button 
                   variant="link" 
                   onClick={() => setIsPricingOpen(true)}
                   className="h-auto p-0 text-[10px] text-amber-500 hover:text-amber-400 font-medium mt-1"
                 >
                     Upgrade for more →
                 </Button>
             </div>
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {!isSidebarOpen && (
          <div className="absolute top-4 left-4 z-30">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(true)}
              className="h-9 w-9 bg-black border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-900"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </Button>
          </div>
        )}
        {/* Top Navigation */}
        <header className="absolute top-0 right-0 p-4 z-20 flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsPricingOpen(true)}
              className="text-zinc-400 hover:text-white hover:bg-zinc-900 h-8 text-xs"
            >
              Upgrade
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsFeedbackOpen(true)}
              className="text-zinc-400 hover:text-white hover:bg-zinc-900 h-8 text-xs"
            >
              Feedback
            </Button>
            <div className="flex items-center gap-2 bg-zinc-900/50 hover:bg-zinc-900 rounded-full px-3 py-1 border border-white/10 transition-colors cursor-pointer group">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 group-hover:scale-110 transition-transform" />
                <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-zinc-100">{userCredits}</span>
                    <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight">Credits</span>
                </div>
            </div>
            <UserMenu />
        </header>

        {view === 'dashboard' ? (
          <>
            {/* Center Content */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-6 z-10 pt-20">
                {/* Background Logo Effect */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                     <div className="text-[400px] font-bold tracking-tighter select-none">CodeUI</div>
                </div>

                <div className="w-full max-w-3xl space-y-8 relative">
                    <h1 className="text-4xl font-semibold text-center tracking-tight">What do you want to create?</h1>
                    
                    {/* Input Area */}
                    <div className="relative group">
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg">
                                        <Plus className="w-5 h-5" />
                                    </Button>
                                    <div className="h-4 w-px bg-white/10 mx-1"></div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-8 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg gap-2 text-xs font-normal px-2 outline-none focus-visible:ring-0"
                                                disabled={isLoadingModels}
                                            >
                                                <div className="text-zinc-400">
                                                    {getModelIcon(selectedModelId)}
                                                </div>
                                                {selectedModelName}
                                                <ChevronDown className="w-3 h-3 opacity-50" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-56 bg-zinc-950 border-white/10 text-zinc-300">
                                            {availableModels.map((model) => (
                                                <DropdownMenuItem 
                                                    key={model.id}
                                                    onClick={() => setSelectedModelId(model.id)}
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
                                    className="h-8 w-8 bg-zinc-800 text-white hover:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    <ArrowUp className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <ActionButton icon={<ImageIcon className="w-4 h-4" />} label="Clone a Screenshot" />
                        <ActionButton icon={<Figma className="w-4 h-4" />} label="Import from Figma" />
                        <ActionButton icon={<Upload className="w-4 h-4" />} label="Upload a Project" />
                        <ActionButton icon={<LayoutTemplate className="w-4 h-4" />} label="Landing Page" />
                    </div>
                </div>
            </div>

            {/* Bottom Projects Section */}
            <div className="w-full max-w-[1400px] mx-auto px-6 pb-8 pt-12 z-10">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold mb-1">My Projects</h2>
                        <p className="text-sm text-zinc-500">Explore what you have built with CodeUI.</p>
                    </div>
                    {projects.length > 0 && (
                      <Button 
                        variant="ghost" 
                        onClick={() => setView('projects')}
                        className="text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 group"
                      >
                          Browse All <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    )}
                </div>

                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                  </div>
                ) : projects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {projects.slice(0, 4).map((project) => (
                          <ProjectCard key={project.id} project={project} />
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FolderOpen className="w-12 h-12 text-zinc-600 mb-4" />
                    <h3 className="text-lg font-medium text-zinc-300 mb-2">No projects yet</h3>
                    <p className="text-sm text-zinc-500 mb-4">Start by creating your first project above!</p>
                  </div>
                )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col w-full max-w-[1400px] mx-auto px-6 pt-24 pb-8 overflow-hidden">
            <div className="flex items-center gap-4 mb-8">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setView('dashboard')}
                className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-900 border border-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">My Projects</h1>
                <p className="text-sm text-zinc-500">A collection of everything you've created.</p>
              </div>
            </div>

            <ScrollArea className="flex-1 -mx-2 px-2">
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                </div>
              ) : projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="w-12 h-12 text-zinc-600 mb-4" />
                  <h3 className="text-lg font-medium text-zinc-300 mb-2">No projects yet</h3>
                  <p className="text-sm text-zinc-500">Start by creating your first project!</p>
                </div>
              )}
            </ScrollArea>
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
      />
    </div>
  )
}

function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`
      flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors
      ${active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}
    `}>
      {icon}
      <span>{label}</span>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
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

  return (
    <div className="group relative bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all cursor-pointer">
      {/* Preview Image */}
      <div className={`aspect-video w-full ${bgGradient} relative grayscale group-hover:grayscale-0 transition-all duration-300`}>
        {/* Emoji display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl opacity-50 group-hover:opacity-80 transition-opacity">
            {project.emoji || "🎨"}
          </span>
        </div>
        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
        {/* Overlay Controls */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-black/50 hover:bg-black text-white border border-white/10">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
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
  )
}

function ActionButton({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-zinc-900/50 hover:bg-zinc-800 text-sm text-zinc-300 transition-colors">
            {icon}
            <span>{label}</span>
        </button>
    )
}
