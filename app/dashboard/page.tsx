"use client"

import { DashboardMain } from "@/components/dashboard/dashboard-main"
import { useState, useEffect, Suspense } from "react"
import { toast } from "sonner"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { deriveProjectNameFromPrompt } from "@/lib/utils/project-name"

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("dashboard_state")
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        if (parsed.hasStarted) {
          // Migrate existing editor state to a new project ID
          const existingEditorState = localStorage.getItem("editor_state")
          if (existingEditorState) {
            const newId = crypto.randomUUID()
            localStorage.setItem(`editor_state_${newId}`, existingEditorState)
            
            // If user is logged in, create the project in DB first
            if (session?.user) {
              fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: newId }),
              }).catch(console.error)
            }

            // Clear old state
            localStorage.removeItem("dashboard_state")
            localStorage.removeItem("editor_state")
            
            // Redirect
            router.push(`/project/${newId}`)
          } else {
             // If no editor state but dashboard thought we started, just clear it
             localStorage.removeItem("dashboard_state")
          }
        }
      } catch (e) {
        console.error("Failed to restore dashboard state", e)
      }
    }
  }, [router, session])

  useEffect(() => {
    if (searchParams.get("success")) {
      toast.success("Subscription successful! Welcome to Pro.")
    }
    if (searchParams.get("canceled")) {
      toast.error("Subscription canceled. You can try again anytime.")
    }
  }, [searchParams])

  const handleStart = async (prompt?: string, model?: string) => {
    const id = crypto.randomUUID()
    const projectName = prompt ? deriveProjectNameFromPrompt(prompt) : undefined
    const requestBody: { id: string; prompt?: string; name?: string } = { id }
    if (prompt) {
      requestBody.prompt = prompt
      requestBody.name = projectName
    }
    
    if (session?.user) {
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })
        
        if (!res.ok) {
          const data = await res.json().catch(() => null)

          if (data?.code === "FREE_PROJECT_LIMIT_REACHED") {
            throw new Error(data.error || "Free project limit reached")
          }

          throw new Error(data?.error || "Failed to create project")
        }
      } catch (error) {
        console.error("Error creating project:", error)
        const message = error instanceof Error ? error.message : "Failed to create project"
        toast.error(message)
        return
      }
    }

    const params = new URLSearchParams()
    if (prompt) params.set("prompt", prompt)
    if (model) params.set("model", model)
    router.push(`/project/${id}?${params.toString()}`)
  }

  return <DashboardMain onStart={handleStart} />
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
