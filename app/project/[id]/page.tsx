"use client"

import { use, Suspense, useEffect, useRef, useState } from "react"
import { EditorLayoutNew } from "@/components/editor-layout"
import { useRouter, useSearchParams } from "next/navigation"
import { consumePendingProjectStart } from "@/lib/utils/project-bootstrap"
import { ProjectTransitionOverlay } from "@/components/project-transition-overlay"
import { AnimatePresence } from "framer-motion"

const ARRIVAL_OVERLAY_DURATION_MS = 6000

interface InitialProjectRequest {
  prompt?: string
  model?: string
}

function ProjectContent({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const promptFromUrl = searchParams.get("prompt") || undefined
  const modelFromUrl = searchParams.get("model") || undefined
  const [initialRequest, setInitialRequest] = useState<InitialProjectRequest>({})
  const [isInitialRequestResolved, setIsInitialRequestResolved] = useState(false)
  const [showArrivalTransition, setShowArrivalTransition] = useState(Boolean(promptFromUrl || modelFromUrl))
  const hasResolvedInitialRequestRef = useRef(false)
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
    setShowArrivalTransition(Boolean(pendingRequest?.prompt || pendingRequest?.model))
    setIsInitialRequestResolved(true)
  }, [id, modelFromUrl, promptFromUrl, router])

  if (!isInitialRequestResolved && !promptFromUrl && !modelFromUrl) {
    return <ProjectTransitionOverlay phase="loading" />
  }

  return (
    <div className="dark h-dvh overflow-hidden bg-zinc-950">
      <EditorLayoutNew 
        projectId={id}
        initialPrompt={resolvedPrompt} 
        initialModel={resolvedModel} 
        onBack={() => router.push("/dashboard")}
      />
      <AnimatePresence>
        {showArrivalTransition ? (
          <ProjectTransitionOverlay
            phase="launching"
            prompt={resolvedPrompt}
            modelName={resolvedModel}
            duration={ARRIVAL_OVERLAY_DURATION_MS}
            onComplete={() => setShowArrivalTransition(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  
  return (
    <Suspense fallback={<ProjectTransitionOverlay phase="loading" />}>
      <ProjectContent id={id} />
    </Suspense>
  )
}
