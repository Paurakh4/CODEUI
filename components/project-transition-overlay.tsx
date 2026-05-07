"use client"

import { useState, useEffect, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

type ProjectTransitionPhase = "launching" | "loading" | "settling"

interface StatusStep {
  id: string
  label: string
}

type StepStatus = "pending" | "active" | "completed"

const STATUS_STEPS: StatusStep[] = [
  { id: "init", label: "Initialize" },
  { id: "config", label: "Configure" },
  { id: "state", label: "Restore" },
  { id: "env", label: "Setup" },
  { id: "ready", label: "Ready" },
]

interface ProjectTransitionOverlayProps {
  phase?: ProjectTransitionPhase
  prompt?: string
  modelName?: string
  duration?: number
  onComplete?: () => void
  className?: string
}

const phaseTitles: Record<ProjectTransitionPhase, string> = {
  launching: "Opening editor",
  loading: "Opening editor",
  settling: "Editor ready",
}

const DURATION_MS = 6000

function useHighResolutionTimer() {
  const [, forceRender] = useState(0)
  const startRef = useRef<number>(performance.now())

  useEffect(() => {
    let rafId: number
    const tick = () => {
      forceRender((n) => n + 1)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return performance.now() - startRef.current
}

function resolveStepStatus(
  elapsedMs: number,
  totalDurationMs: number,
  stepIndex: number,
  totalSteps: number,
): StepStatus {
  if (totalDurationMs <= 0) return "pending"
  const stepInterval = totalDurationMs / (totalSteps + 1)
  const stepTime = (stepIndex + 1) * stepInterval
  if (elapsedMs >= stepTime) return "completed"
  if (stepIndex === 0) return "active"
  if (elapsedMs >= stepIndex * stepInterval) return "active"
  return "pending"
}

export function ProjectTransitionOverlay({
  phase = "launching",
  prompt,
  modelName,
  duration = DURATION_MS,
  onComplete,
  className,
}: ProjectTransitionOverlayProps) {
  const shouldReduceMotion = useReducedMotion()
  const elapsedMs = useHighResolutionTimer()
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const hasCalledComplete = useRef(false)

  const totalSteps = STATUS_STEPS.length
  const progress = Math.min(elapsedMs / duration, 1)

  useEffect(() => {
    if (elapsedMs < duration || hasCalledComplete.current || !onCompleteRef.current) return
    hasCalledComplete.current = true
    onCompleteRef.current()
  }, [duration, elapsedMs])

  const title = phaseTitles[phase]
  const trimmedPrompt = prompt?.trim()
  const previewPrompt = trimmedPrompt
    ? trimmedPrompt.length > 96
      ? `${trimmedPrompt.slice(0, 96).trimEnd()}...`
      : trimmedPrompt
    : undefined

  const motionTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.56, ease: [0.16, 1, 0.3, 1] as const }

  return (
    <motion.div
      className={cn(
        "fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-[#050505]/96 px-4 text-white backdrop-blur-xl",
        className,
      )}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.015 }}
      transition={motionTransition}
      aria-live="polite"
      aria-busy={progress < 1}
    >
      <motion.div
        className="absolute inset-x-4 top-6 h-px bg-white/[0.08] sm:inset-x-8"
        initial={shouldReduceMotion ? false : { scaleX: 0.25, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={motionTransition}
      />

      <motion.div
        className="relative w-full max-w-lg"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 1.01 }}
        transition={motionTransition}
      >
        <div className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#0A0A0B] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.025] px-4 py-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
              {title}
            </span>
            {modelName ? (
              <div className="max-w-[36vw] truncate rounded-md border border-white/[0.06] bg-black/30 px-2 py-1 text-[11px] text-zinc-400">
                {modelName}
              </div>
            ) : null}
          </div>

          <div className="px-5 py-8 sm:px-7 sm:py-10">
            <div className="relative mx-auto max-w-sm">
              <div className="absolute left-0 right-0 top-[9px] h-[2px] bg-white/[0.06]" />

              <motion.div
                className="absolute left-0 top-[9px] h-[2px] bg-emerald-400/70"
                style={{ width: `${Math.min(progress * 100, 99)}%` }}
                initial={false}
              />

              <div className="relative flex justify-between">
                {STATUS_STEPS.map((step, index) => {
                  const status = resolveStepStatus(
                    elapsedMs,
                    duration,
                    index,
                    totalSteps,
                  )
                  const isCompleted = status === "completed"
                  const isActive = status === "active"
                  const isPending = status === "pending"

                  return (
                    <div key={step.id} className="flex flex-col items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center">
                        {isCompleted && (
                          <motion.div
                            initial={
                              shouldReduceMotion ? false : { scale: 0 }
                            }
                            animate={{ scale: 1 }}
                            transition={{
                              duration: 0.4,
                              ease: [0.34, 1.56, 0.64, 1],
                            }}
                          >
                            <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-400">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                fill="none"
                                className="text-[#050505]"
                              >
                                <motion.path
                                  d="M2.5 5.5l1.5 1.5 3.5-3.5"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeDasharray={10}
                                  initial={
                                    shouldReduceMotion
                                      ? {}
                                      : { strokeDashoffset: 10 }
                                  }
                                  animate={{ strokeDashoffset: 0 }}
                                  transition={{
                                    duration: 0.35,
                                    ease: [0.23, 1, 0.32, 1],
                                    delay: 0.05,
                                  }}
                                />
                              </svg>
                            </div>
                          </motion.div>
                        )}

                        {isActive && (
                          <motion.div
                            initial={
                              shouldReduceMotion
                                ? false
                                : { opacity: 0, scale: 0.5 }
                            }
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                          </motion.div>
                        )}

                        {isPending && (
                          <motion.div
                            initial={
                              shouldReduceMotion ? false : { opacity: 0 }
                            }
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.25 }}
                            className="h-2 w-2 rounded-full bg-zinc-600"
                          />
                        )}
                      </div>

                      <motion.span
                        initial={
                          shouldReduceMotion ? false : { opacity: 0, y: 4 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: shouldReduceMotion ? 0 : index * 0.04,
                        }}
                        className={cn(
                          "text-[10px] font-medium leading-none tracking-wide transition-colors duration-500",
                          isCompleted && "text-[#9B9B9F]",
                          isActive && "text-[#E7E7E9]",
                          isPending && "text-[#6B6B70]",
                        )}
                      >
                        {step.label}
                      </motion.span>
                    </div>
                  )
                })}
              </div>
            </div>

            {previewPrompt ? (
              <motion.div
                className="mx-auto mt-6 max-w-sm rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  ease: [0.23, 1, 0.32, 1],
                  delay: 0.1,
                }}
              >
                <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  Prompt
                </div>
                <p className="truncate text-xs leading-5 text-[#6B6B70]">
                  {previewPrompt}
                </p>
              </motion.div>
            ) : null}
          </div>

          <div className="h-px bg-white/[0.05]" />

          <div className="relative h-[2px] bg-white/[0.04]">
            <motion.div
              className="absolute inset-y-0 left-0 bg-emerald-400/80"
              initial={shouldReduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: progress }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.25, ease: [0.23, 1, 0.32, 1] }
              }
              style={{ width: "100%", transformOrigin: "left" }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
