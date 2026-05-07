"use client"

import { useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface LiveCodePreviewProps {
  code: string
  className?: string
}

interface HighlightSegment {
  text: string
  className?: string
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function highlightLine(line: string): HighlightSegment[] {
  const escaped = escapeHtml(line)
  if (!escaped) return [{ text: "" }]

  const segments: HighlightSegment[] = []
  const regex =
    /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?[a-zA-Z][a-zA-Z0-9]*)|(&gt;)|(&lt;)|(&quot;.*?&quot;)|('[^']*?')|([a-zA-Z-]+(?=\s*=\s*(&quot;|')))|\b([a-zA-Z][a-zA-Z0-9]*\b(?=&gt;))/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(escaped)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: escaped.slice(lastIndex, match.index) })
    }

    if (match[1]) {
      segments.push({ text: match[1], className: "text-zinc-500 italic" })
    } else if (match[2]) {
      segments.push({ text: match[2], className: "text-sky-400" })
    } else if (match[3] || match[4]) {
      segments.push({ text: match[3] || match[4], className: "text-zinc-500" })
    } else if (match[5] || match[6]) {
      segments.push({ text: match[5] || match[6], className: "text-emerald-400/80" })
    } else if (match[7]) {
      segments.push({ text: match[7], className: "text-amber-400/70" })
    } else if (match[8]) {
      segments.push({ text: match[8], className: "text-sky-400" })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < escaped.length) {
    segments.push({ text: escaped.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ text: escaped }]
}

function getLineWidthClass(lineIndex: number): string {
  const pattern = lineIndex % 10
  if (pattern < 3) return "w-[72%]"
  if (pattern < 6) return "w-[58%]"
  if (pattern < 8) return "w-[85%]"
  return "w-[45%]"
}

export function LiveCodePreview({ code, className }: LiveCodePreviewProps) {
  const prevLineCountRef = useRef(0)
  const lines = code.split("\n")
  const lineCount = lines.length
  const isEmpty = !code.trim()

  useEffect(() => {
    prevLineCountRef.current = lineCount
  }, [lineCount])

  const prevLineCount = prevLineCountRef.current

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-zinc-800/60 bg-[#050505] shadow-lg",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-900/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-400">
            Live preview
          </span>
        </div>
        <span className="font-mono text-[10px] text-zinc-600">
          {lineCount} lines
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-h-[80px]">
          {isEmpty ? (
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="h-3 w-2 rounded-sm bg-zinc-800/50 animate-pulse" />
              <span className="h-3 w-32 rounded-sm bg-zinc-800/50 animate-pulse" />
            </div>
          ) : (
            lines.map((line, index) => {
              const isNewLine = prevLineCount > 0 && index >= prevLineCount

              if (line.trim() === "") {
                return (
                  <motion.div
                    key={index}
                    initial={isNewLine ? { opacity: 0, height: 0 } : undefined}
                    animate={{ opacity: 1, height: 17 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    className="flex"
                  >
                    <span className="w-[36px] shrink-0 select-none text-right font-mono text-[10px] leading-[17px] text-zinc-700">
                      {index + 1}
                    </span>
                    <span className="flex-1" />
                  </motion.div>
                )
              }

              const segments = highlightLine(line)
              const isLast = index === lineCount - 1

              return (
                <motion.div
                  key={index}
                  initial={
                    isNewLine
                      ? { opacity: 0, y: 10, height: 0 }
                      : undefined
                  }
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  transition={{
                    duration: 0.3,
                    ease: [0.23, 1, 0.32, 1],
                    delay: isNewLine ? 0.04 : 0,
                  }}
                  className="flex items-start"
                >
                  <span
                    className={cn(
                      "w-[36px] shrink-0 select-none text-right font-mono text-[10px] leading-[17px]",
                      isLast ? "text-zinc-500" : "text-zinc-700",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1 font-mono text-[11px] leading-[17px] text-zinc-300">
                    {segments.map((seg, si) => (
                      <span key={si} className={seg.className}>
                        {seg.text || "\u00A0"}
                      </span>
                    ))}
                  </span>
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
