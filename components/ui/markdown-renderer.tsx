"use client"

import { useMemo } from "react"
import { marked } from "marked"

// Configure marked for chat-friendly output
marked.setOptions({
  breaks: true,      // Convert \n to <br> (like GitHub-flavored markdown)
  gfm: true,         // GitHub-flavored markdown
})

function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript\s*:/gi, "")
}

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    if (!content) return ""
    const raw = marked.parse(content, { async: false }) as string
    return sanitize(raw)
  }, [content])

  if (!content) return null

  return (
    <div
      className={`chat-markdown ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
