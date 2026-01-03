"use client"

import { DashboardMain } from "@/components/dashboard/dashboard-main"
import { EditorLayoutNew } from "@/components/editor-layout"
import { useState } from "react"

export default function DashboardPage() {
  const [hasStarted, setHasStarted] = useState(false)
  const [initialData, setInitialData] = useState<{ prompt?: string, model?: string }>({})

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
        />
      </div>
    )
  }

  return <DashboardMain onStart={handleStart} />
}
