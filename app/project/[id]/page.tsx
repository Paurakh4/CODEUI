"use client"

import { use, Suspense } from "react"
import { EditorLayoutNew } from "@/components/editor-layout"
import { useRouter, useSearchParams } from "next/navigation"

function ProjectContent({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get("prompt") || undefined
  const initialModel = searchParams.get("model") || undefined
  const router = useRouter()

  return (
    <div className="dark h-screen overflow-hidden">
      <EditorLayoutNew 
        projectId={id}
        initialPrompt={initialPrompt} 
        initialModel={initialModel} 
        onBack={() => router.push("/dashboard")}
      />
    </div>
  )
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  
  return (
    <Suspense fallback={<div className="dark h-screen flex items-center justify-center text-zinc-400">Loading project...</div>}>
      <ProjectContent id={id} />
    </Suspense>
  )
}
