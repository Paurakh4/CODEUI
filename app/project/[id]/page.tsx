"use client"

import { use, Suspense, useEffect, useRef, useState } from "react"
import { EditorLayoutNew } from "@/components/editor-layout"
import { useRouter, useSearchParams } from "next/navigation"
import { consumePendingProjectStart } from "@/lib/utils/project-bootstrap"

interface InitialProjectRequest {
  prompt?: string
  model?: string
}

function ProjectContent({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [initialRequest, setInitialRequest] = useState<InitialProjectRequest>({})
  const [isInitialRequestResolved, setIsInitialRequestResolved] = useState(false)
  const hasResolvedInitialRequestRef = useRef(false)
  const promptFromUrl = searchParams.get("prompt") || undefined
  const modelFromUrl = searchParams.get("model") || undefined
  const resolvedPrompt = promptFromUrl ?? initialRequest.prompt
  const resolvedModel = modelFromUrl ?? initialRequest.model

  useEffect(() => {
    if (hasResolvedInitialRequestRef.current) {
      return
    }

    if (promptFromUrl || modelFromUrl) {
      consumePendingProjectStart(id)
      hasResolvedInitialRequestRef.current = true
      setInitialRequest({ prompt: promptFromUrl, model: modelFromUrl })
      setIsInitialRequestResolved(true)

      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", `/project/${id}`)
      }

      return
    }

    const pendingRequest = consumePendingProjectStart(id)
    hasResolvedInitialRequestRef.current = true
    setInitialRequest(pendingRequest || {})
    setIsInitialRequestResolved(true)
  }, [id, modelFromUrl, promptFromUrl, router])

  if (!isInitialRequestResolved && !promptFromUrl && !modelFromUrl) {
    return <div className="dark min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">Loading project...</div>
  }

  return (
    <div className="dark h-dvh overflow-hidden bg-zinc-950">
      <EditorLayoutNew 
        projectId={id}
        initialPrompt={resolvedPrompt} 
        initialModel={resolvedModel} 
        onBack={() => router.push("/dashboard")}
      />
    </div>
  )
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  
  return (
    <Suspense fallback={<div className="dark min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">Loading project...</div>}>
      <ProjectContent id={id} />
    </Suspense>
  )
}
