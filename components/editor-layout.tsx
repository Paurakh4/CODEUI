"use client"

import { useState } from "react"
import { TopNav } from "@/components/top-nav"
import { AI_Prompt } from "@/components/ui/animated-ai-input"
import { Canvas } from "@/components/canvas"
import { ChevronDown, ChevronLeft } from "lucide-react"
import { useSession } from "next-auth/react"
import { useAuthDialog } from "@/components/auth-dialog-provider"

interface Message {
  id: string;
  content: string;
  isUser: boolean;
}

export function EditorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState("neat-prompts")
  const { data: session } = useSession()
  const { showSignIn } = useAuthDialog()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm your AI assistant. How can I help you today?",
      isUser: false,
    },
    {
      id: "2", 
      content: "I need help with my project.",
      isUser: true,
    },
    {
      id: "3",
      content: "I'd be happy to help! What specific aspect of your project would you like assistance with?",
      isUser: false,
    },
  ])

  const projects = ["neat-prompts", "project-2", "project-3"]

  const handleSend = (message: string) => {
    if (!session) {
      showSignIn()
      return
    }
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
    };
    setMessages(prev => [...prev, userMessage]);

    // Generate mock AI response
    setTimeout(() => {
      const mockResponses = [
        "That's an interesting point! Let me think about that.",
        "I understand what you're asking. Here's what I think:",
        "Great question! Based on what you've shared, I suggest:",
        "Thanks for sharing that. In my experience, the best approach would be:",
        "I see what you mean. Let me provide some insights on this topic.",
        "That's a common challenge. Here's how you might approach it:",
      ];
      const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: `${randomResponse} This is a mock AI response to: "${message}"`,
        isUser: false,
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
  }

  const handleFileAttach = () => {
    if (!session) {
      showSignIn()
      return
    }
    // Handle file attachment
    console.log("File attach clicked")
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-[340px]
          flex flex-col bg-[#1c1c1c]
          transition-transform duration-150 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Project Header */}
        <div className="relative">
          <div className="h-12 px-4 flex items-center justify-between bg-[#1c1c1c]">
            <div className="inline-flex items-center">
              {/* Logo container that swaps to a back icon on hover */}
              <button
                className="group p-0.5 rounded-md flex items-center justify-center relative"
                aria-label="Project logo"
                title="Project logo"
              >
                <img
                  src="/Codeui.svg"
                  alt="CodeUI Logo"
                  className="h-8 w-auto transition-all duration-200 ease-in-out group-hover:opacity-0 group-hover:scale-95"
                />
                <ChevronLeft
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 opacity-0 transition-opacity duration-200 ease-in-out group-hover:opacity-100"
                  aria-hidden="true"
                />
              </button>
            </div>
            <div 
              className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800 rounded px-2 py-1 transition-colors"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span className="font-medium text-sm">{selectedProject}</span>
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute top-full left-4 right-4 bg-[#1c1c1c] border border-zinc-700 rounded-lg shadow-lg z-10 mt-1">
              {projects.map((project) => (
                <button
                  key={project}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                  onClick={() => {
                    setSelectedProject(project)
                    setDropdownOpen(false)
                  }}
                >
                  {project}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI Chat UI Area */}
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg px-3 py-2 max-w-[80%] ${message.isUser ? 'bg-[#272725]' : ''}`}>
                  <p className="text-zinc-100 text-sm">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Input */}
        <div className="px-4 pb-4">
          <AI_Prompt onSend={handleSend} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${sidebarOpen ? 'lg:ml-[340px]' : ''}`}>
        <TopNav sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* Canvas Area */}
        <div className="flex-1 border-l border-t border-zinc-800 overflow-hidden">
          <Canvas />
        </div>
      </div>
    </div>
  )
}
