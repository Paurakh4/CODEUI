"use client"

import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DesignDiscoveryAnswer, DesignDiscoveryQuestion } from "@/lib/design-discovery"
import { cn } from "@/lib/utils"

interface DesignDiscoveryBlockProps {
  reasoning: string
  question?: DesignDiscoveryQuestion
  answer?: DesignDiscoveryAnswer
  currentQuestionIndex: number
  totalQuestions: number
  isLoading?: boolean
  isSubmitting?: boolean
  onSelectOption: (question: DesignDiscoveryQuestion, optionLabel: string) => void
  onCustomAnswerChange: (question: DesignDiscoveryQuestion, value: string) => void
  onCustomAnswerSubmit: () => void
  onPrevious: () => void
  onNext: () => void
  onSkip: () => void
}

export function DesignDiscoveryBlock({
  reasoning,
  question,
  answer,
  currentQuestionIndex,
  totalQuestions,
  isLoading = false,
  isSubmitting = false,
  onSelectOption,
  onCustomAnswerChange,
  onCustomAnswerSubmit,
  onPrevious,
  onNext,
  onSkip,
}: DesignDiscoveryBlockProps) {
  const customAnswer = answer?.source === "custom" ? answer.answer : ""
  const hasAnswer = Boolean(answer && answer.source !== "skip" && answer.answer.trim())
  const isLastQuestion = currentQuestionIndex >= totalQuestions - 1

  return (
    <div className="max-w-[90%] rounded-lg border border-white/[0.06] bg-zinc-950/80 px-3 py-2.5 text-zinc-100 backdrop-blur-sm">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-200">
          {isLoading || isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-100">
                {isLoading ? "Checking the brief" : "Guided design discovery"}
              </p>
              {!isLoading && totalQuestions > 0 ? (
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  {currentQuestionIndex + 1}/{totalQuestions}
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-5 text-zinc-400">{reasoning}</p>
          </div>

          {isLoading || !question ? (
            <div className="rounded-md border border-dashed border-white/[0.06] bg-white/[0.02] px-2 py-3 text-xs text-zinc-500">
              Looking for the smallest set of design questions that will materially improve the result.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-zinc-100">{question.question}</p>
                {question.description ? (
                  <p className="text-[11px] leading-4 text-zinc-500">{question.description}</p>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                {question.options.map((option) => {
                  const isSelected = answer?.source === "option" && answer.answer === option.label

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onSelectOption(question, option.label)}
                      disabled={isSubmitting}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-left transition-colors",
                        isSelected
                          ? "border-white/[0.10] bg-white/[0.06] text-zinc-100"
                          : "border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:border-white/[0.08] hover:bg-white/[0.04]",
                      )}
                    >
                      <span className="block text-xs font-medium">{option.label}</span>
                      {option.description ? (
                        <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">{option.description}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Type your own answer</p>
                <Input
                  value={customAnswer}
                  onChange={(event) => onCustomAnswerChange(question, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || !customAnswer.trim()) {
                      return
                    }

                    event.preventDefault()
                    onCustomAnswerSubmit()
                  }}
                  disabled={isSubmitting}
                  placeholder={question.customAnswerPlaceholder || "Type your own answer"}
                  className="h-7 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-700"
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-zinc-900 pt-1">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onPrevious}
                    disabled={currentQuestionIndex === 0 || isSubmitting}
                    aria-label="Previous question"
                    className="text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {question.allowSkip ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onSkip}
                      disabled={isSubmitting}
                      className="text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                    >
                      Skip
                    </Button>
                  ) : null}
                </div>

                <Button
                  type="button"
                  variant={isLastQuestion ? "secondary" : "ghost"}
                  size={isLastQuestion ? "sm" : "icon-sm"}
                  onClick={onNext}
                  disabled={!hasAnswer || isSubmitting}
                  aria-label={isLastQuestion ? "Generate design" : "Next question"}
                  className={cn(
                    isLastQuestion
                      ? "bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
                      : "text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100",
                  )}
                >
                  {isLastQuestion ? (
                    <>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                      Generate design
                    </>
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}