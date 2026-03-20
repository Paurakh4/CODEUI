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
  const hasResolvedInitialRequestRef = useRef(false)

  useEffect(() => {
    if (hasResolvedInitialRequestRef.current) {
      return
    }

    const promptFromUrl = searchParams.get("prompt") || undefined
    const modelFromUrl = searchParams.get("model") || undefined

    if (promptFromUrl || modelFromUrl) {
      hasResolvedInitialRequestRef.current = true
      setInitialRequest({ prompt: promptFromUrl, model: modelFromUrl })
      router.replace(`/project/${id}`)
      return
    }

    const pendingRequest = consumePendingProjectStart(id)
    if (pendingRequest) {
      hasResolvedInitialRequestRef.current = true
      setInitialRequest(pendingRequest)
    }
  }, [id, router, searchParams])

  return (
    <div className="dark h-dvh overflow-hidden bg-zinc-950">
      <EditorLayoutNew 
        projectId={id}
        initialPrompt={initialRequest.prompt} 
        initialModel={initialRequest.model} 
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
