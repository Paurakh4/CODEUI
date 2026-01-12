"use client"

import { DashboardMain } from "@/components/dashboard/dashboard-main"
import { EditorLayoutNew } from "@/components/editor-layout"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"

export default function DashboardPage() {
  const [hasStarted, setHasStarted] = useState(false)
  const [initialData, setInitialData] = useState<{ prompt?: string, model?: string }>({})
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("success")) {
      toast.success("Subscription successful! Welcome to Pro.")
    }
    if (searchParams.get("canceled")) {
      toast.error("Subscription canceled. You can try again anytime.")
    }
  }, [searchParams])

  const handleStart = (prompt?: string, model?: string) => {
    setInitialData({ prompt, model })
    setHasStarted(true)
  }

  if (hasStarted) {
    return (
      <div className="dark h-screen overflow-hidden">
        <EditorLayoutNew 
          initialPrompt={initialData.prompt} 
          initialModel={initialData.model} 
          onBack={() => setHasStarted(false)}
        />
      </div>
    )
  }

  return <DashboardMain onStart={handleStart} />
}
