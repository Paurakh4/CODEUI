"use client"

import { startTransition, useEffect, useState, useCallback, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { TopNav } from "@/components/top-nav-new"
import { DesignDiscoveryBlock } from "@/components/design-discovery-block"
import { VersionHistory, type Version as HistoryVersion } from "@/components/version-history"
import { AI_Prompt } from "@/components/ui/animated-ai-input"
import { PreviewFrame, extractSelectedElementInfo, type SelectedElementInfo } from "@/components/preview-frame"
import { CodeEditor } from "@/components/code-editor"
import { StylePanel, type SelectedElement, type StyleProperty, type StyleChange } from "@/components/style-panel"
import { TextShimmer } from "@/components/ui/text-shimmer";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ChevronDown, ChevronLeft, PanelLeftClose, X, ChevronUp, RotateCcw } from "lucide-react"
import { SolarCodeSquareLinear } from "@/components/solar-code-square-linear"
import { useSession } from "next-auth/react"
import { useAuthDialog } from "@/components/auth-dialog-provider"
import { extractHtml, useAIChat, type AIStreamProgress } from "@/hooks/use-ai-chat"
import { useStyleHistory } from "@/hooks/use-style-history"
import { useEditor } from "@/stores/editor-store"
import { toast } from "sonner"
import { StreamParser } from "@/lib/parsers/stream-parser"
import {
  FULL_DOCUMENT_RECOVERY_FAILURE_MESSAGE,
  describeTargetedUpdateFailure,
  isCompleteHtmlDocument,
  selectStableHtmlDocument,
  type PatchFailureContext,
} from "@/lib/ai-update-recovery"
import { getElementPropertyFields } from "@/lib/design-element-properties"
import { validatePromptScope } from "@/lib/prompt-scope"
import { isFullDocumentRecoveryMode, isPatchRepairRecoveryMode, resolveRecoveryMode, type RecoveryMode } from "@/lib/recovery-mode"
import { dedupeAdjacentAssistantMessages } from "@/lib/utils/chat-message-dedupe"
import { isVisionCapableModel } from "@/lib/ai-models"
import { extractDesignTokensFromHtml, type DesignTokens } from "@/lib/design-tokens"
import { isVaguePrompt } from "@/lib/reprompting/page-health-check"
import { stripConflictMarkerLines } from "@/lib/reprompting/conflict-marker-sanitizer"
import { cn, fastHash } from "@/lib/utils"
import { convertHtmlToReactComponent, generateExportPrompt, sanitizeFileName } from "@/lib/utils/export"
import { deriveProjectNameFromPrompt, isDefaultProjectName, normalizeProjectName } from "@/lib/utils/project-name"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  composePromptWithDiscoveryAnswers,
  type DesignDiscoveryAnswer,
  type DesignDiscoveryQuestion,
} from "@/lib/design-discovery"

// Debounce helper for auto-save
function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    }) as T,
    [delay]
  )
}

type ViewMode = "preview" | "design" | "code"
type DeviceMode = "desktop" | "tablet" | "mobile"
type ExportFormat = "html" | "react" | "prompt"
type CheckpointKind = "auto" | "manual" | "restore"
type CheckpointTrigger = "before-ai" | "after-ai" | "manual-save" | "restore"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  isThinking?: boolean
  thinkingContent?: string
  progressLabel?: string
  images?: string[]
}

function normalizeMessageRole(value: unknown): Message["role"] {
  return value === "assistant" ? "assistant" : "user"
}

function normalizeMessageTimestamp(value: unknown): Date {
  const candidate = value instanceof Date ? value : new Date(typeof value === "string" || typeof value === "number" ? value : Date.now())
  return Number.isNaN(candidate.getTime()) ? new Date() : candidate
}

function getAtomicFollowUpProgressLabel(progress: AIStreamProgress): string {
  switch (progress.stage) {
    case "preparing":
      return "Analyzing update..."
    case "finalizing":
      return "Finalizing update..."
    default:
      return "Updating page..."
  }
}

interface CheckpointOptions {
  silent?: boolean
  kind?: CheckpointKind
  trigger?: CheckpointTrigger
  restoredFromId?: string
}

interface PendingRecovery {
  prompt: string
  failedFiles: string[]
  model?: string
  reason?: string
  baseHtml?: string
  selectedElement?: string
  isPromptScopeRecovery?: boolean
  mode: RecoveryMode
}

interface PendingDesignDiscovery {
  prompt: string
  model?: string
  reasoning: string
  questions: DesignDiscoveryQuestion[]
  answers: Record<string, DesignDiscoveryAnswer | undefined>
  currentQuestionIndex: number
  isLoading: boolean
  isSubmitting: boolean
}

const MONGO_OBJECT_ID_REGEX = /^[a-f\d]{24}$/i
const STREAM_PROTOCOL_MARKER_REGEX = /(?:^|\n)\s*(?:<<<<<<<|=======|>>>>>>>)/m
const MAX_ASSISTANT_SUMMARY_HTML_LENGTH = 20_000

const createEditorEntityId = (prefix: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const selectElementSafely = (
  doc: Document,
  selector?: string | null,
): HTMLElement | null => {
  if (typeof selector !== "string") {
    return null
  }

  const normalizedSelector = selector.trim()
  if (!normalizedSelector) {
    return null
  }

  try {
    return doc.querySelector(normalizedSelector) as HTMLElement | null
  } catch {
    return null
  }
}

const coerceVersionId = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)

  if (value != null) {
    const normalized = String(value)
    if (normalized && normalized !== "[object Object]") {
      return normalized
    }
  }

  return createEditorEntityId("local")
}

const TEXT_CONTENT_PROPERTY = "__textContent__"
const MAX_SCOPE_RECOVERY_ATTEMPTS = 2

// Empty starter document. The editor opens with a blank canvas and blank
// code; AI generation populates the document on the first request. There is
// no preloaded template — the user sees an empty state until they prompt.
const EMPTY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Untitled</title>
</head>
<body>
</body>
</html>`

function isEmptyStarterDocument(value: string | null | undefined): boolean {
  if (!value) return true
  const trimmed = value.trim()
  if (!trimmed) return true

  if (typeof DOMParser === "undefined") {
    return /<body[^>]*>\s*<\/body>/i.test(trimmed)
  }

  try {
    const doc = new DOMParser().parseFromString(trimmed, "text/html")
    const body = doc.body
    if (!body) return true
    return body.children.length === 0 && (body.textContent || "").trim().length === 0
  } catch {
    return /<body[^>]*>\s*<\/body>/i.test(trimmed)
  }
}

function canUseStableProjectHtml(value: string | null | undefined): value is string {
  return Boolean(value && isCompleteHtmlDocument(value) && !isEmptyStarterDocument(value))
}

// Random prompt examples for the dice button
const EXAMPLE_PROMPTS = [
  "A modern portfolio website for a photographer with a dark theme and image gallery",
  "A SaaS landing page with pricing cards, testimonials, and a hero section",
  "A restaurant website with menu, about section, and reservation form",
  "A fitness app landing page with features, testimonials, and download buttons",
  "A personal blog homepage with recent posts and newsletter signup",
  "An e-commerce product page with image gallery, reviews, and add to cart",
  "A startup landing page with animated hero, team section, and contact form",
  "A music streaming app landing with playlist preview and feature highlights",
]

function cleanSummaryText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim()
}

function joinSummaryParts(parts: string[]): string {
  if (parts.length === 0) {
    return ""
  }

  if (parts.length === 1) {
    return parts[0]
  }

  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`
  }

  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
}

function uniqueSummaryItems(items: string[], maxItems: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of items) {
    const normalized = cleanSummaryText(item).toLowerCase()
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    result.push(cleanSummaryText(item))

    if (result.length >= maxItems) {
      break
    }
  }

  return result
}

function inferProjectType(prompt: string, html: string): string {
  const source = `${prompt} ${html}`.toLowerCase()

  if (source.includes("photograph")) return "a photographer portfolio"
  if (source.includes("portfolio")) return "a portfolio site"
  if (source.includes("saas")) return "a SaaS landing page"
  if (source.includes("restaurant")) return "a restaurant website"
  if (source.includes("blog")) return "a blog homepage"
  if (source.includes("e-commerce") || source.includes("ecommerce") || source.includes("shop")) return "an e-commerce experience"
  if (source.includes("fitness")) return "a fitness landing page"
  if (source.includes("music")) return "a music-focused landing page"
  if (source.includes("startup")) return "a startup landing page"

  return "a custom website"
}

function extractContentSummary(doc: Document, prompt: string, html: string): string {
  const fullText = doc.body?.textContent?.toLowerCase() || html.toLowerCase()
  const features: string[] = []

  if (doc.querySelector("header, [class*='hero'], [id*='hero'], main h1")) {
    features.push("a strong hero section")
  }
  if ((doc.querySelectorAll("img").length >= 4) || /gallery|portfolio|featured work|selected work/.test(fullText)) {
    features.push("an image-led gallery")
  }
  if (/about|story|bio/.test(fullText)) {
    features.push("an about section")
  }
  if (/project|work|case study|portfolio/.test(fullText)) {
    features.push("a featured work showcase")
  }
  if (/service|offer|expertise/.test(fullText)) {
    features.push("a services section")
  }
  if (/testimonial|review|client/.test(fullText)) {
    features.push("testimonials")
  }
  if (doc.querySelector("form") || /contact|book|reserve|get in touch|newsletter/.test(fullText)) {
    features.push("a contact call to action")
  }

  const headingLabels = uniqueSummaryItems(
    Array.from(doc.querySelectorAll("h1, h2, h3"))
      .map((node) => cleanSummaryText(node.textContent))
      .filter((text) => text.length >= 4 && text.length <= 48),
    4,
  )

  const featureSummary = uniqueSummaryItems(features, 5)
  const projectType = inferProjectType(prompt, html)

  if (featureSummary.length > 0) {
    return `Generated: ${projectType} with ${joinSummaryParts(featureSummary)}.`
  }

  if (headingLabels.length > 0) {
    return `Generated: ${projectType} centered on ${joinSummaryParts(headingLabels.map((label) => `"${label}"`))}.`
  }

  return `Generated: ${projectType}.`
}

function extractDesignSummary(doc: Document, html: string): string {
  const lowerHtml = html.toLowerCase()
  const designNotes: string[] = []

  const darkSignals = /(bg-black|bg-zinc|bg-slate|bg-neutral|#0[0-9a-f]{2}|#111|#000|color-scheme:\s*dark|text-white)/.test(lowerHtml)
  const lightSignals = /(bg-white|bg-stone-50|bg-zinc-50|#f[0-9a-f]{2}|#fff|color-scheme:\s*light|text-slate-900)/.test(lowerHtml)

  if (darkSignals && !lightSignals) {
    designNotes.push("a dark, high-contrast palette")
  } else if (lightSignals && !darkSignals) {
    designNotes.push("a light, airy palette")
  } else if (/gradient/.test(lowerHtml)) {
    designNotes.push("a bold gradient-driven palette")
  } else {
    designNotes.push("a polished modern palette")
  }

  if (doc.querySelectorAll("img").length >= 4) {
    designNotes.push("an image-forward composition")
  }

  if (/font-family:[^;]*(serif|playfair|cormorant|merriweather|baskerville)/.test(lowerHtml)) {
    designNotes.push("editorial typography")
  } else {
    designNotes.push("clean contemporary typography")
  }

  if (/grid|columns-|masonry/.test(lowerHtml)) {
    designNotes.push("a structured grid layout")
  } else if (/flex/.test(lowerHtml)) {
    designNotes.push("a balanced split layout")
  }

  if (/card|rounded-\[|rounded-xl|rounded-2xl|shadow/.test(lowerHtml)) {
    designNotes.push("layered card treatments")
  }

  if (/transition|hover|animate|keyframes/.test(lowerHtml)) {
    designNotes.push("subtle motion cues")
  }

  return `UI design: ${joinSummaryParts(uniqueSummaryItems(designNotes, 5))}.`
}

function buildGenerationSummary(options: {
  prompt: string
  html: string
}): string {
  const { prompt, html } = options

  if (typeof DOMParser === "undefined" || !html.trim()) {
    const projectType = inferProjectType(prompt, html)
    return [`Generated: ${projectType}.`, "UI design: a polished modern layout."].join("\n")
  }

  const doc = new DOMParser().parseFromString(html, "text/html")

  return [
    extractContentSummary(doc, prompt, html),
    extractDesignSummary(doc, html),
  ].join("\n")
}

function extractFollowUpContentNotes(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase()
  const notes: string[] = []

  if (/testimonial|review|social proof|client quote/.test(lowerPrompt)) {
    notes.push("testimonials")
  }
  if (/pricing|plan|tier|subscription/.test(lowerPrompt)) {
    notes.push("pricing content")
  }
  if (/hero|headline|masthead/.test(lowerPrompt)) {
    notes.push("hero content")
  }
  if (/feature|benefit|capability/.test(lowerPrompt)) {
    notes.push("feature messaging")
  }
  if (/faq|question|answer/.test(lowerPrompt)) {
    notes.push("an FAQ section")
  }
  if (/nav|navbar|navigation|menu/.test(lowerPrompt)) {
    notes.push("navigation")
  }
  if (/footer/.test(lowerPrompt)) {
    notes.push("footer content")
  }
  if (/form|contact|signup|sign up|login|log in|newsletter/.test(lowerPrompt)) {
    notes.push("form flows")
  }
  if (/gallery|portfolio|image|photo|media/.test(lowerPrompt)) {
    notes.push("visual content")
  }
  if (/dashboard|chart|metric|table|analytics/.test(lowerPrompt)) {
    notes.push("data presentation")
  }
  if (/card|tile/.test(lowerPrompt)) {
    notes.push("card content")
  }
  if (/copy|text|messaging|content/.test(lowerPrompt)) {
    notes.push("copy hierarchy")
  }
  if (/cta|button|call to action/.test(lowerPrompt)) {
    notes.push("call-to-action areas")
  }

  return uniqueSummaryItems(notes, 4)
}

function extractFollowUpDesignNotes(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase()
  const notes: string[] = []

  if (/spacing|padding|margin|gap|compact|dense|airy|breathing room/.test(lowerPrompt)) {
    notes.push("spacing refinements")
  }
  if (/layout|grid|column|alignment|position|structure|responsive/.test(lowerPrompt)) {
    notes.push("layout adjustments")
  }
  if (/color|palette|theme|dark|light|contrast|background/.test(lowerPrompt)) {
    notes.push("palette refinements")
  }
  if (/typography|font|headline|heading|text size|copy/.test(lowerPrompt)) {
    notes.push("typography updates")
  }
  if (/button|card|section|component|navbar|footer|form|modal/.test(lowerPrompt)) {
    notes.push("component polish")
  }
  if (/animation|motion|transition|hover|microinteraction/.test(lowerPrompt)) {
    notes.push("motion updates")
  }

  return uniqueSummaryItems(notes, 4)
}

function buildFollowUpSummary(prompt: string, html: string): string {
  const normalizedPrompt = cleanSummaryText(prompt)
  const projectType = inferProjectType(prompt, html)
  const contentNotes = extractFollowUpContentNotes(prompt)
  const designNotes = extractFollowUpDesignNotes(prompt)
  const requestLine = normalizedPrompt
    ? `Updated the current UI to ${normalizedPrompt.charAt(0).toLowerCase()}${normalizedPrompt.slice(1)}.`
    : "Updated the current UI."

  const generatedLine = contentNotes.length > 0
    ? `Generated: an updated ${projectType} with ${joinSummaryParts(contentNotes)} aligned to the latest request.`
    : `Generated: an updated ${projectType} aligned to the latest request.`

  const designLine = designNotes.length > 0
    ? `UI design: ${joinSummaryParts(designNotes)} while preserving the existing visual system.`
    : contentNotes.length > 0
      ? `UI design: integrated ${joinSummaryParts(contentNotes)} into the existing visual system with consistent hierarchy.`
      : "UI design: integrated the requested update into the existing visual system."

  return [requestLine, generatedLine, designLine].join("\n")
}

function buildPromptScopeRecoveryPrompt(prompt: string, missingRequirements: string[]): string {
  const missingList = missingRequirements.join(", ")

  return [
    prompt.trim(),
    "",
    "Important: the previous attempt omitted parts of the requested UI scope.",
    `You must fully implement these missing requirements: ${missingList}.`,
    "Do not simplify the interface, remove sections, or collapse the request into a lighter version.",
    "Return a complete, feature-rich single-page UI that covers the full prompt in detail.",
  ].join("\n")
}

function formatMissingScopeMessage(missingRequirements: string[]): string {
  if (missingRequirements.length === 0) {
    return "The generated UI still missed some requested core features."
  }

  const preview = missingRequirements.slice(0, 3).join(", ")
  const remainingCount = missingRequirements.length - Math.min(missingRequirements.length, 3)

  if (remainingCount > 0) {
    return `The generated UI still missed some requested core features, including ${preview}, and ${remainingCount} more.`
  }

  return `The generated UI still missed some requested core features, including ${preview}.`
}

function hasStreamProtocolMarkers(value: string): boolean {
  return STREAM_PROTOCOL_MARKER_REGEX.test(value)
}

function getRenderableStreamingHtml(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || hasStreamProtocolMarkers(trimmed)) {
    return null
  }

  const completeHtml = extractHtml(trimmed)
  if (isCompleteHtmlDocument(completeHtml)) {
    return completeHtml.trim()
  }

  const fencedMatch = trimmed.match(/^```html?\s*([\s\S]*)$/i)
  const candidate = (fencedMatch ? fencedMatch[1] : trimmed).replace(/\s*```$/, "").trim()
  if (!candidate || !isCompleteHtmlDocument(candidate)) {
    return null
  }

  return candidate
}

/**
 * Sanitize thinking content for display — strip raw CSS, code fences, and
 * `<style>` blocks that are part of the model's chain-of-thought, not meant
 * for the user. Keeps natural-language reasoning intact.
 *
 * ponytail: heuristic-based; a CSS rule with a natural-language prefix
 * (e.g. "I should use..." followed by a code block) might lose the prefix.
 * Upgrade path: a token-level classifier, but this is good enough for now.
 */
function sanitizeThinkingForDisplay(raw: string): string {
  if (!raw) return ""

  let result = raw

  // Strip markdown code fences (with or without language tag).
  result = result.replace(/```[\w-]*\s*[\s\S]*?```/g, "\n")
  // Strip unclosed opening fences (truncated output).
  result = result.replace(/```[\w-]*\s*\n[\s\S]*$/g, "\n")

  // Strip <style>...</style> blocks.
  result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "\n")

  // Strip CSS custom property declaration runs (--foo:...; chains).
  result = result.replace(/^(?:\s*--[-\w]+\s*:\s*[^;]+;\s*)+$/gm, "\n")

  // Strip CSS rule blocks (.class{...}, #id{...}, tag{...}) on their own lines.
  result = result.replace(/^[ \t]*[.#@]?[-\w]+\s*\{[\s\S]*?\}[ \t]*$/gm, "\n")

  // Strip runs of CSS declarations (property: value; sequences) that form a block.
  result = result.replace(/^(?:\s*[-\w]+\s*:\s*[^;{}]+;\s*){3,}$/gm, "\n")

  // Collapse runs of blank lines.
  result = result.replace(/\n{3,}/g, "\n\n")

  return result.trim()
}

/**
 * Strip markdown code fences and thinking tags from raw streamed output
 * before displaying it in the Monaco code editor. Does NOT affect the
 * committed HTML — only the draft shown during streaming.
 */
function stripDisplayFences(raw: string): string {
  let result = raw
  // Remove leading ```html / ``` fence line.
  result = result.replace(/^```[\w-]*\s*\n/, "")
  // Remove trailing ``` fence line.
  result = result.replace(/\n\s*```\s*$/, "")
  // Remove unmatched opening fence (truncated output).
  result = result.replace(/\n\s*```[\w-]*\s*$/, "")
  // Remove thinking tags and their content (model reasoning in raw output).
  result = result.replace(/<think(?:ing)?[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, "")
  result = result.replace(/<reasoning[^>]*>[\s\S]*?<\/reasoning>/gi, "")
  // Strip SEARCH/REPLACE + UPDATE_FILE/PROJECT_NAME/NEW_FILE conflict-marker
  // LINES (keep the content between them) so Monaco never flashes
  // `<<<<<<< SEARCH` / `=======` / `>>>>>>> REPLACE` during follow-up drafts.
  // Server-side `sanitizeConflictMarkers` already strips whole blocks from
  // the finalized HTML; this is display-only for the in-flight draft.
  result = stripConflictMarkerLines(result)
  return result
}

function buildAssistantSummaryHtmlSnapshot(html: string): string {
  const normalized = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (normalized.length <= MAX_ASSISTANT_SUMMARY_HTML_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, MAX_ASSISTANT_SUMMARY_HTML_LENGTH)}...`
}


interface EditorLayoutNewProps {
  initialPrompt?: string
  initialModel?: string
  initialImages?: string[]
  onBack?: () => void
  projectId?: string
}

export function EditorLayoutNew({ initialPrompt, initialModel, initialImages, onBack, projectId }: EditorLayoutNewProps) {
  const router = useRouter()
  const {
    state,
    setModel,
    setApplyingPatch,
    setPrimaryColor,
    setSecondaryColor,
    setTheme,
  } = useEditor()
  
  const storageKey = projectId ? `editor_state_${projectId}` : "editor_state"

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Close sidebar on mobile by default after mount
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [])
  const [viewMode, setViewMode] = useState<ViewMode>("preview")
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop")
  const [draftAiOutput, setDraftAiOutput] = useState("")
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>("html")
  
  // Project State
  const [projectName, setProjectName] = useState("untitled-project")
  const [htmlContent, setHtmlContent] = useState(EMPTY_HTML)
  const htmlContentRef = useRef(htmlContent)
  const [codeVersionHash, setCodeVersionHash] = useState("")

  const [versions, setVersions] = useState<HistoryVersion[]>([])
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [previewHtmlContent, setPreviewHtmlContent] = useState<string | null>(null)

  useEffect(() => {
    htmlContentRef.current = htmlContent
  }, [htmlContent])

  const normalizeVersion = useCallback((version: any): HistoryVersion => {
    const timestamp = version.createdAt || version.timestamp
    const rawId = version?._id ?? version?.id
    return {
      id: coerceVersionId(rawId),
      htmlContent: version.htmlContent || version.content || "",
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      description: version.description || undefined,
    }
  }, [])

  const makeLocalVersion = useCallback((content: string, description?: string): HistoryVersion => {
    return {
      id: createEditorEntityId("local"),
      htmlContent: content,
      timestamp: new Date(),
      description,
    }
  }, [])

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null)
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([])
  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Set<string>>(new Set())
  const [expandedUserMessages, setExpandedUserMessages] = useState<Set<string>>(new Set())
  const hasProcessedInitialPrompt = useRef(false)
  const initialPromptStartTimerRef = useRef<number | null>(null)
  const lastUserPromptRef = useRef("")
  const recoveryInFlightRef = useRef(false)
  const promptScopeRecoveryInFlightRef = useRef(false)
  const scopeRecoveryAttemptsRef = useRef(0)
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecovery | null>(null)
  const [pendingDesignDiscovery, setPendingDesignDiscovery] = useState<PendingDesignDiscovery | null>(null)
  // ponytail: single-slot prompt queue (Bug #5). User can queue one prompt
  // while generating; auto-sends on terminal states only (not during recovery).
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null)
  const queuedPromptRef = useRef<{
    prompt: string
    model?: string
    images?: Array<{ dataUrl: string }>
  } | null>(null)
  const activeProjectKeyRef = useRef<string | null>(null)
  const messagesRef = useRef<Message[]>([])
  const activeThinkingScrollRef = useRef<HTMLDivElement | null>(null)
  const thinkingScrollFrameRef = useRef<number | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const designDiscoveryRequestRef = useRef(0)

  const toggleUserMessage = useCallback((id: string) => {
    setExpandedUserMessages((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleThinking = useCallback((id: string) => {
    setExpandedThinkingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const LONG_USER_MSG_THRESHOLD = 200

  // Sync initialModel with global store
  useEffect(() => {
    if (initialModel) {
      setModel(initialModel)
    }
  }, [initialModel, setModel])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // ponytail: only auto-scroll if the user is near the bottom — respects upward reading
  function isNearBottom(el: HTMLElement, threshold = 48): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }

  function scrollToBottom(el: HTMLElement): void {
    el.scrollTop = el.scrollHeight
  }

  // Auto-scroll the chat messages container — only when user is near the bottom
  useEffect(() => {
    const container = chatScrollRef.current
    if (!container || !isNearBottom(container)) return
    scrollToBottom(container)
  }, [messages])

  // Auto-scroll the thinking panel — only when user is near the bottom
  useEffect(() => {
    const container = activeThinkingScrollRef.current
    if (!container || !isNearBottom(container)) return

    if (thinkingScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(thinkingScrollFrameRef.current)
    }

    thinkingScrollFrameRef.current = window.requestAnimationFrame(() => {
      const scrollViewport = activeThinkingScrollRef.current
      if (scrollViewport && isNearBottom(scrollViewport)) {
        scrollToBottom(scrollViewport)
      }
      thinkingScrollFrameRef.current = null
    })

    return () => {
      if (thinkingScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(thinkingScrollFrameRef.current)
        thinkingScrollFrameRef.current = null
      }
    }
  }, [messages])

  // Style History for undo/redo
  const [styleHistoryState, styleHistoryActions] = useStyleHistory(30)
  
  // Track pending style updates for smooth animations
  const pendingStyleUpdate = useRef<{ property: string; value: StyleProperty } | null>(null)
  const lastAppliedHtml = useRef<string>("")
  const requestStableHtmlRef = useRef<string>(EMPTY_HTML)
  const lastPatchFailureRef = useRef<PatchFailureContext | null>(null)
  // ponytail: stable preview ref for follow-ups — preview shows this committed
  // HTML during generation, never the streaming draft. Prevents blank/broken
  // intermediate states (Bug #3).
  const stablePreviewHtmlRef = useRef<string>(EMPTY_HTML)
  // ponytail: last saved HTML — used to clear the orange dot when restored
  // content matches what's persisted (Bug #6).
  const lastSavedHtmlRef = useRef<string>("")
  // ponytail: last failed request for retry (Bug #2). Reuses requestStableHtmlRef
  // so every retry starts from the same committed baseline.
  const lastFailedRequestRef = useRef<{
    prompt: string
    model?: string
    stableHtml: string
  } | null>(null)
  const previewRef = useRef<HTMLIFrameElement>(null)
  const activeAiRequestRef = useRef<{
    isFollowUp: boolean
    recoveryMode?: RecoveryMode
    assistantMessageId?: string
  }>({ isFollowUp: false })
  const [previewUpdateSignal, setPreviewUpdateSignal] = useState<{ token: number; mode: "full" | "style" }>({
    token: 0,
    mode: "full",
  })
  
  // MongoDB sync refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false)
  const lastSavedContentRef = useRef<string>("")
  // ponytail: ref not state — avoids re-render cascade when projectId changes from "new" to real UUID
  const createdProjectIdRef = useRef<string | null>(null)

  // Auth
  const { data: session, status: sessionStatus } = useSession()
  const { showSignIn } = useAuthDialog()
  
  const [isRestored, setIsRestored] = useState(false)
  const [isLoadingProject, setIsLoadingProject] = useState(false)

  const clearPendingDesignDiscovery = useCallback(() => {
    designDiscoveryRequestRef.current += 1
    setPendingDesignDiscovery(null)
  }, [])

  const resetTransientProjectState = useCallback(() => {
    if (initialPromptStartTimerRef.current !== null) {
      window.clearTimeout(initialPromptStartTimerRef.current)
      initialPromptStartTimerRef.current = null
    }

    hasProcessedInitialPrompt.current = false
    lastUserPromptRef.current = ""
    recoveryInFlightRef.current = false
    promptScopeRecoveryInFlightRef.current = false
    scopeRecoveryAttemptsRef.current = 0
    lastAppliedHtml.current = EMPTY_HTML
    requestStableHtmlRef.current = EMPTY_HTML
    lastPatchFailureRef.current = null

    setPendingRecovery(null)
  clearPendingDesignDiscovery()
    setMessages([])
    setExpandedThinkingIds(new Set())
    setSelectedElement(null)
    setPanelPosition(null)
    setDraftAiOutput("")
    setHasGeneratedOnce(false)
    setVersions([])
    setCurrentVersionId(null)
    setVersionHistoryOpen(false)
    setPreviewHtmlContent(null)
    setHasUnsavedChanges(false)
    setProjectName("untitled-project")
    setHtmlContent(EMPTY_HTML)
    htmlContentRef.current = EMPTY_HTML
    lastSavedContentRef.current = ""
    createdProjectIdRef.current = null
    setPreviewUpdateSignal({ token: 0, mode: "full" })
    setCodeVersionHash("")
    setViewMode("preview")
    setDeviceMode("desktop")
    setSidebarOpen(true)
    setIsRestored(false)
    setApplyingPatch(false)
  }, [clearPendingDesignDiscovery, setApplyingPatch])

  useEffect(() => {
    const nextProjectKey = projectId || "new"
    if (activeProjectKeyRef.current === nextProjectKey) {
      return
    }

    activeProjectKeyRef.current = nextProjectKey
    resetTransientProjectState()
    setIsLoadingProject(Boolean(projectId && projectId !== "new" && session?.user?.id))
  }, [projectId, resetTransientProjectState, session?.user?.id])

  const applyChangeToIframe = useCallback((selector: string, property: string, value: StyleProperty) => {
    const iframe = previewRef.current
    const doc = iframe?.contentDocument
    if (!doc) return

    const element = selectElementSafely(doc, selector)
    if (!element) return

    if (property === TEXT_CONTENT_PROPERTY) {
      element.textContent = value?.toString() ?? ""
      return
    }

    element.style[property as any] = value?.toString() ?? ""
  }, [])

  const commitHtmlContentUpdate = useCallback((nextHtml: string, options?: { styleUpdate?: boolean }) => {
    htmlContentRef.current = nextHtml
    if (isCompleteHtmlDocument(nextHtml)) {
      lastAppliedHtml.current = nextHtml.trim()
    }
    // ponytail: update stable preview ref on every commit so follow-up
    // previews always show the last committed stable HTML (Bug #3).
    stablePreviewHtmlRef.current = nextHtml.trim()
    setPreviewUpdateSignal((prev) => ({
      token: prev.token + 1,
      // Never skip reload on AI-generated updates — always "full".
      mode: options?.styleUpdate === true ? "style" : "full",
    }))
    setHtmlContent(nextHtml)
    setCodeVersionHash(fastHash(nextHtml.trim()))
    setHasUnsavedChanges(true)
  }, [])

  const restorePreservedHtml = useCallback((preferredHtml?: string | null) => {
    const restoredHtml = selectStableHtmlDocument(
      [
        preferredHtml,
        requestStableHtmlRef.current,
        lastAppliedHtml.current,
        htmlContentRef.current,
        htmlContent,
      ],
      EMPTY_HTML,
    )

    commitHtmlContentUpdate(restoredHtml)
    // ponytail: clear orange dot when restored HTML matches persisted state (Bug #6).
    if (restoredHtml.trim() === lastSavedHtmlRef.current) {
      setHasUnsavedChanges(false)
    }
    return restoredHtml
  }, [commitHtmlContentUpdate, htmlContent])

  const getStableCheckpointHtml = useCallback((preferredHtml?: string | null) => {
    const candidates = [
      preferredHtml,
      requestStableHtmlRef.current,
      lastAppliedHtml.current,
      htmlContentRef.current,
      htmlContent,
    ]

    const stableCandidate = candidates.find((candidate) => canUseStableProjectHtml(candidate))
    return stableCandidate?.trim() || null
  }, [htmlContent])

  const getTargetedRecoveryFailureMessage = useCallback((validationError?: string) => {
    return describeTargetedUpdateFailure(
      lastPatchFailureRef.current ?? (validationError
        ? {
            kind: "response-validation-failed",
            detail: validationError,
          }
        : null),
    )
  }, [])

  const resetActiveAiRequest = useCallback(() => {
    activeAiRequestRef.current = { isFollowUp: false }
  }, [])

  const extractSelectedElementHtmlFromContent = useCallback((sourceHtml: string, selector?: string | null) => {
    if (!sourceHtml || !selector) {
      return undefined
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(sourceHtml, "text/html")
    return selectElementSafely(doc, selector)?.outerHTML
  }, [])

  const syncSelectedElementFromIframe = useCallback((
    target: string | HTMLElement,
    clickPosition?: { x: number; y: number },
  ) => {
    const iframe = previewRef.current
    const doc = iframe?.contentDocument
    const iframeWindow = iframe?.contentWindow
    if (!doc || !iframeWindow) return null

    const element = typeof target === "string"
      ? selectElementSafely(doc, target)
      : target

    if (!element) return null

    const snapshot = extractSelectedElementInfo(
      element,
      iframeWindow,
      clickPosition ?? panelPosition ?? { x: 0, y: 0 },
    )

    setSelectedElement((prev) => ({
      id: snapshot.selector,
      type: snapshot.type,
      styles: snapshot.styles,
      properties: snapshot.properties,
      clickPosition: clickPosition ?? prev?.clickPosition ?? snapshot.clickPosition,
    }))

    return snapshot
  }, [panelPosition])

  const applyElementProperties = useCallback((element: HTMLElement, properties?: SelectedElement["properties"]) => {
    if (!properties) return

    if (typeof properties.id === "string" && properties.id) {
      element.id = properties.id
    } else {
      element.removeAttribute("id")
    }

    if (typeof properties.className === "string" && properties.className) {
      element.className = properties.className
    } else {
      element.removeAttribute("class")
    }

    for (const field of getElementPropertyFields(element.tagName.toLowerCase())) {
      if (field.key === "id" || field.key === "className") continue

      const attributeName = field.attributeName ?? field.key
      const value = properties[field.key]

      if (field.control === "boolean") {
        const isEnabled = value === true || value === "true"
        const propertyName = field.propertyName ?? field.key

        if (propertyName in element) {
          try {
            ;(element as unknown as Record<string, boolean>)[propertyName] = isEnabled
          } catch {
            // Ignore readonly DOM property assignments
          }
        }

        if (isEnabled) {
          element.setAttribute(attributeName, "")
        } else {
          element.removeAttribute(attributeName)
        }

        continue
      }

      const normalizedValue = value?.toString() ?? ""

      if (normalizedValue) {
        element.setAttribute(attributeName, normalizedValue)
      } else {
        element.removeAttribute(attributeName)
      }
    }
  }, [])

  // ponytail: creates the project in DB on first explicit save. Returns the effective project ID.
  // Uses a ref (not state) to avoid re-render cascades when projectId transitions from "new" to UUID.
  const ensureProjectCreated = useCallback(async (content?: string, name?: string): Promise<string | null> => {
    if (createdProjectIdRef.current) return createdProjectIdRef.current
    if (projectId && projectId !== "new") return projectId
    if (!session?.user?.id) return null

    const id = crypto.randomUUID()
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: name || projectName || "Untitled Project",
          htmlContent: content || htmlContentRef.current || "",
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || "Failed to create project")
        return null
      }
      createdProjectIdRef.current = id
      lastSavedContentRef.current = content || htmlContentRef.current || ""
      setHasUnsavedChanges(false)
      // Update URL silently so refreshes work, without triggering React re-render
      window.history.replaceState(window.history.state, "", `/project/${id}`)
      return id
    } catch (error) {
      console.error("Error creating project:", error)
      toast.error("Failed to create project")
      return null
    }
  }, [projectId, projectName, session?.user?.id, toast])

  // Save project to MongoDB
  const saveProjectToMongo = useCallback(async (content: string, name?: string) => {
    if (!session?.user?.id) return
    if (isSavingRef.current) return
    if (content === lastSavedContentRef.current && !name) return

    const effectiveId = await ensureProjectCreated(content, name)
    if (!effectiveId) return
    
    isSavingRef.current = true
    try {
      const updateData: Record<string, string> = { htmlContent: content }
      if (name) updateData.name = name

      const res = await fetch(`/api/projects/${effectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })
      
      if (res.ok) {
        lastSavedContentRef.current = content
        // ponytail: track last persisted HTML to clear orange dot when restored
        // content matches persisted state (Bug #6).
        lastSavedHtmlRef.current = content.trim()
        setHasUnsavedChanges(false)
      } else {
        console.error("Failed to save project to MongoDB")
      }
    } catch (error) {
      console.error("Error saving project:", error)
    } finally {
      isSavingRef.current = false
    }
  }, [session?.user?.id, ensureProjectCreated])

  // Debounced auto-save (2 seconds after last change)
  const debouncedSave = useDebouncedCallback((content: string) => {
    saveProjectToMongo(content)
  }, 2000)

  // Save messages to MongoDB
  const saveMessageToMongo = useCallback(async (message: { role: "user" | "assistant"; content: string; thinkingContent?: string; images?: string[] }) => {
    if (!session?.user?.id) return

    const effectiveId = await ensureProjectCreated()
    if (!effectiveId) return
    
    try {
      await fetch(`/api/projects/${effectiveId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      })
    } catch (error) {
      console.error("Error saving message:", error)
    }
  }, [session?.user?.id, ensureProjectCreated])

  const handleEnhancePrompt = useCallback(async (prompt: string, model?: string) => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      toast.info("Prompt Enhance needs text", {
        description: "Add a UI prompt first.",
      })
      return ""
    }

    if (!session) {
      showSignIn()
      return trimmedPrompt
    }

    try {
      const response = await fetch("/api/ai/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          model: model ?? state.selectedModel,
          strength: "standard",
        }),
      })

      if (response.status === 401) {
        showSignIn()
        return trimmedPrompt
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || "Failed to enhance prompt")
      }

      // ── Clarifying questions (Bug #7) ──
      if (data?.clarifyingQuestions && Array.isArray(data.clarifyingQuestions) && data.clarifyingQuestions.length > 0) {
        const questions = data.clarifyingQuestions as string[]
        toast("What would you like to improve?", {
          description: questions.join(" "),
          duration: 8000,
        })
        // Return the original prompt so the user can refine it manually
        // with the guidance from the toast.
        return trimmedPrompt
      }

      if (data?.warning) {
        toast.info(data?.skipped ? "Prompt Enhance skipped" : "Prompt Enhance", {
          description: data.warning,
        })
      }

      const enhancedPrompt = typeof data?.enhancedPrompt === "string" && data.enhancedPrompt.trim()
        ? data.enhancedPrompt.trim()
        : trimmedPrompt

      if (enhancedPrompt === trimmedPrompt && !data?.warning) {
        toast.info("Prompt already clear", {
          description: "Prompt Enhance did not need to rewrite the current request.",
        })
      }

      return enhancedPrompt
    } catch (error) {
      toast.error("Prompt Enhance unavailable", {
        description: error instanceof Error ? error.message : "Failed to enhance prompt.",
      })
      return trimmedPrompt
    }
  }, [session, showSignIn, state.selectedModel, toast])

  const requestGenerationAssistantMessage = useCallback(async ({
    prompt,
    html,
    isFollowUp,
    model,
  }: {
    prompt: string
    html: string
    isFollowUp: boolean
    model?: string
  }) => {
    const trimmedPrompt = prompt.trim()
    const trimmedHtml = buildAssistantSummaryHtmlSnapshot(html)

    if (!trimmedPrompt || !trimmedHtml || !session?.user?.id) {
      return null
    }

    try {
      const response = await fetch("/api/ai/generation-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          html: trimmedHtml,
          isFollowUp,
          model: model ?? state.selectedModel,
        }),
      })

      if (response.status === 401) {
        return null
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        return null
      }

      return typeof data?.assistantMessage === "string" && data.assistantMessage.trim()
        ? data.assistantMessage.trim()
        : null
    } catch {
      return null
    }
  }, [session?.user?.id, state.selectedModel])

  const handleComposerDraftChange = useCallback((draft: string) => {
    const trimmedDraft = draft.trim()
    if (
      pendingDesignDiscovery &&
      trimmedDraft &&
      trimmedDraft !== pendingDesignDiscovery.prompt.trim()
    ) {
      clearPendingDesignDiscovery()
    }
  }, [clearPendingDesignDiscovery, pendingDesignDiscovery])

  // Save version to MongoDB
  const saveVersionToMongo = useCallback(async (
    htmlContent: string,
    description?: string,
    options?: CheckpointOptions
  ) => {
    if (!session?.user?.id) return null

    const effectiveId = await ensureProjectCreated(htmlContent)
    if (!effectiveId) return null
    
    try {
      const res = await fetch(`/api/projects/${effectiveId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          htmlContent,
          description,
          kind: options?.kind,
          trigger: options?.trigger,
          restoredFromId: options?.restoredFromId,
        }),
      })

      if (!res.ok) {
        return null
      }

      const data = await res.json()
      return data?.version || null
    } catch (error) {
      console.error("Error saving version:", error)
      return null
    }
  }, [session?.user?.id, ensureProjectCreated])

  const createCheckpoint = useCallback(async (
    description?: string,
    options?: CheckpointOptions
  ) => {
    const content = getStableCheckpointHtml(htmlContentRef.current || htmlContent)
    if (!content) return

    const savedVersion = await saveVersionToMongo(content, description, options)
    const nextVersion = savedVersion
      ? normalizeVersion(savedVersion)
      : makeLocalVersion(content, description)

    setVersions((prev) => [...prev, nextVersion])
    setCurrentVersionId(nextVersion.id)
    if (savedVersion || !session?.user?.id) {
      lastSavedContentRef.current = content
      setHasUnsavedChanges(false)
    }

    if (!options?.silent) {
      toast.success("Checkpoint saved", {
        description: description || "Saved a new version.",
      })
    }
  }, [getStableCheckpointHtml, htmlContent, makeLocalVersion, normalizeVersion, saveVersionToMongo, session?.user?.id, toast])

  // Load project from MongoDB on mount (if projectId exists)
  useEffect(() => {
    if (!projectId || projectId === "new" || !session?.user?.id) return
    
    let cancelled = false
    setIsLoadingProject(true)

    ;(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) {
          if (res.status === 404) {
            toast.error("Project not found")
            router.push("/dashboard")
          }
          return
        }

        const data = await res.json()
        if (cancelled) return

        const project = data.project
        if (project) {
          setProjectName(project.name || "Untitled Project")
          if (typeof project.htmlContent === "string" && project.htmlContent.trim().length > 0) {
            setHtmlContent(project.htmlContent)
            htmlContentRef.current = project.htmlContent
            lastAppliedHtml.current = isCompleteHtmlDocument(project.htmlContent)
              ? project.htmlContent.trim()
              : EMPTY_HTML
            requestStableHtmlRef.current = lastAppliedHtml.current
            lastSavedContentRef.current = project.htmlContent
          } else {
            setHtmlContent(EMPTY_HTML)
            htmlContentRef.current = EMPTY_HTML
            lastAppliedHtml.current = EMPTY_HTML
            requestStableHtmlRef.current = EMPTY_HTML
            lastSavedContentRef.current = ""
          }
          // Restore messages from MongoDB
          if (project.messages && project.messages.length > 0) {
            const restoredMessages = dedupeAdjacentAssistantMessages<Message>(project.messages.map((m: { role: string; content: string; thinkingContent?: string; images?: string[]; createdAt: string }, index: number): Message => ({
              id: createEditorEntityId(`mongo_${index}`),
              role: normalizeMessageRole(m.role),
              content: typeof m.content === "string" ? m.content : "",
              thinkingContent: typeof m.thinkingContent === "string" ? m.thinkingContent : undefined,
              images: Array.isArray(m.images) ? m.images : undefined,
              timestamp: normalizeMessageTimestamp(m.createdAt),
              isThinking: false,
            })))
            setMessages(restoredMessages)
            setHasGeneratedOnce(restoredMessages.some((message) => message.role === "assistant"))
          } else {
            setHasGeneratedOnce(false)
          }
        }
      } catch (error) {
        console.error("Error loading project:", error)
        toast.error("Failed to load project")
      } finally {
        if (!cancelled) {
          setIsLoadingProject(false)
          setIsRestored(true)
        }
      }
    })()

    return () => { cancelled = true }
  }, [projectId, session?.user?.id, router, toast])

  // Load version history from MongoDB
  useEffect(() => {
    if (!projectId || projectId === "new" || !session?.user?.id) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/versions`)
        if (!res.ok) return

        const data = await res.json()
        if (cancelled) return

        if (Array.isArray(data?.versions)) {
          const normalized = data.versions.map(normalizeVersion)
          setVersions(normalized)
          const latest = normalized[normalized.length - 1]
          if (latest) {
            setCurrentVersionId(latest.id)
          }
        }
      } catch (error) {
        console.error("Error loading versions:", error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, session?.user?.id, normalizeVersion])

  // Load state from localStorage (fallback for new projects or when no projectId)
  useEffect(() => {
    if (projectId && projectId !== "new" && sessionStatus === "loading") return

    // Skip localStorage restore if we're loading from MongoDB
    if (projectId && projectId !== "new" && session?.user?.id) return
    
    const savedState = localStorage.getItem(storageKey)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        if (parsed.htmlContent) {
          setHtmlContent(parsed.htmlContent)
          htmlContentRef.current = parsed.htmlContent
          if (isCompleteHtmlDocument(parsed.htmlContent)) {
            lastAppliedHtml.current = parsed.htmlContent.trim()
            requestStableHtmlRef.current = parsed.htmlContent.trim()
          }
        }
        if (parsed.projectName) setProjectName(parsed.projectName)
        // Convert date strings back to Date objects for messages
        if (parsed.messages) {
          const restoredMessages = dedupeAdjacentAssistantMessages<Message>(parsed.messages.map((m: any, index: number): Message => ({
            id: typeof m?.id === "string" && m.id ? m.id : createEditorEntityId(`local_restore_${index}`),
            role: normalizeMessageRole(m?.role),
            content: typeof m?.content === "string" ? m.content : "",
            thinkingContent: typeof m?.thinkingContent === "string" ? m.thinkingContent : undefined,
            images: Array.isArray(m?.images) ? m.images : undefined,
            timestamp: normalizeMessageTimestamp(m?.timestamp),
            isThinking: Boolean(m?.isThinking),
            progressLabel: typeof m?.progressLabel === "string" ? m.progressLabel : undefined,
          })))
          setMessages(restoredMessages)
        }
        if (parsed.viewMode) setViewMode(parsed.viewMode)
        if (parsed.deviceMode) setDeviceMode(parsed.deviceMode)
        if (parsed.hasGeneratedOnce) setHasGeneratedOnce(parsed.hasGeneratedOnce)
        if (parsed.sidebarOpen !== undefined) setSidebarOpen(parsed.sidebarOpen)
      } catch (e) {
        console.error("Failed to restore editor state", e)
      }
    }
    setIsRestored(true)
  }, [storageKey, projectId, session?.user?.id, sessionStatus])

  // Save state to localStorage
  useEffect(() => {
    if (!isRestored) return

    const stateToSave = {
      htmlContent,
      projectName,
      messages,
      viewMode,
      deviceMode,
      hasGeneratedOnce,
      sidebarOpen,
      lastSaved: new Date().toISOString()
    }
    localStorage.setItem(storageKey, JSON.stringify(stateToSave))
  }, [htmlContent, projectName, messages, viewMode, deviceMode, hasGeneratedOnce, sidebarOpen, isRestored, storageKey])

  useEffect(() => {
    if (previewHtmlContent && viewMode !== "preview") {
      setPreviewHtmlContent(null)
    }
  }, [previewHtmlContent, viewMode])

  useEffect(() => {
    if (!versionHistoryOpen && previewHtmlContent) {
      setPreviewHtmlContent(null)
    }
  }, [previewHtmlContent, versionHistoryOpen])

  const finalizeAssistantMessage = useCallback(
    (content: string, assistantMessageId?: string) => {
      const lastMessage = messagesRef.current[messagesRef.current.length - 1]
      const targetMessageId = assistantMessageId
        ?? (lastMessage && lastMessage.role === "assistant" ? lastMessage.id : undefined)
      const targetMessage = targetMessageId
        ? messagesRef.current.find((message) => message.id === targetMessageId && message.role === "assistant")
        : null
      const assistantMessageToPersist = targetMessage
        ? {
            role: "assistant" as const,
            content,
            thinkingContent: targetMessage.thinkingContent,
          }
        : null

      // Auto-collapse the thinking panel once the response is finalized.
      if (targetMessageId) {
        setExpandedThinkingIds((prev) => {
          if (!prev.has(targetMessageId)) return prev
          const next = new Set(prev)
          next.delete(targetMessageId)
          return next
        })
      }

      setMessages((prev) => {
        if (!targetMessageId) {
          return prev
        }

        let didUpdate = false
        const nextMessages = prev.map((message) => {
          if (message.id !== targetMessageId || message.role !== "assistant") {
            return message
          }

          didUpdate = true
          return { ...message, isThinking: false, content, progressLabel: undefined }
        })

        return didUpdate ? nextMessages : prev
      })

      if (assistantMessageToPersist) {
        void saveMessageToMongo(assistantMessageToPersist)
      }
    },
    [saveMessageToMongo]
  )

  const updateAssistantProgress = useCallback((progress: AIStreamProgress) => {
    const activeRequest = activeAiRequestRef.current
    const progressLabel = activeRequest.isFollowUp
      ? getAtomicFollowUpProgressLabel(progress)
      : progress.message

    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1]
      if (!lastMessage || lastMessage.role !== "assistant") {
        return prev
      }

      return prev.map((message, index) =>
        index === prev.length - 1
          ? { ...message, progressLabel, isThinking: true }
          : message,
      )
    })
  }, [])

  const finalizeGenerationSuccess = useCallback(() => {
    setDraftAiOutput("")
    setApplyingPatch(false)
    setViewMode("preview")
    setHasGeneratedOnce(true)
    lastPatchFailureRef.current = null
    requestStableHtmlRef.current = selectStableHtmlDocument(
      [htmlContentRef.current, lastAppliedHtml.current],
      EMPTY_HTML,
    )

    if (htmlContentRef.current) {
      createCheckpoint("AI-generated update", {
        silent: true,
        kind: "auto",
        trigger: "after-ai",
      })
    }
  }, [createCheckpoint, setApplyingPatch])

  const {
    sendMessage: sendAIMessage,
    cancel: cancelAI,
    isGenerating,
  } = useAIChat({
    onContentUpdate: (content) => {
      // Stream output into Monaco (not into chat) — strip fences/thinking
      // so Monaco never shows ```html or <thinking> markers.
      setDraftAiOutput(stripDisplayFences(content))

      const streamingHtml = getRenderableStreamingHtml(content)
      const activeRequest = activeAiRequestRef.current
      if (streamingHtml && !activeRequest.isFollowUp) {
        commitHtmlContentUpdate(streamingHtml)
      }
    },
    // Follow-up requests buffer their committed content server-side so the
    // SEARCH/REPLACE protocol can be validated before the client applies it.
    // The API still emits a "draft" stream with the raw partial output so we
    // can render the in-flight model output in Monaco for live feedback.
    onDraftUpdate: (draft) => {
      setDraftAiOutput(stripDisplayFences(draft))
    },
    onThinkingUpdate: (thinkingContent) => {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === "assistant") {
          // Keep the streaming thinking panel expanded.
          setExpandedThinkingIds((ids) => {
            if (ids.has(lastMessage.id)) return ids
            const next = new Set(ids)
            next.add(lastMessage.id)
            return next
          })
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, thinkingContent, isThinking: true } : m
          )
        }
        return prev
      })
    },
    onProgressUpdate: updateAssistantProgress,
    onNoop: (reason) => {
      resetActiveAiRequest()
      lastFailedRequestRef.current = null
      setDraftAiOutput("")
      setApplyingPatch(false)
      setViewMode("preview")
      // ponytail: clear dot when no-op — no changes were made (Bug #6).
      if (htmlContentRef.current.trim() === lastSavedHtmlRef.current) {
        setHasUnsavedChanges(false)
      }
      finalizeAssistantMessage(reason)
      // ponytail: dequeue queued prompt on terminal no-op (Bug #5).
      dequeueAndSend()
    },
    onContentWipeRejected: (data) => {
      const activeRequest = activeAiRequestRef.current
      resetActiveAiRequest()
      lastFailedRequestRef.current = null
      recoveryInFlightRef.current = false
      promptScopeRecoveryInFlightRef.current = false
      scopeRecoveryAttemptsRef.current = 0
      setPendingRecovery(null)
      setDraftAiOutput("")
      restorePreservedHtml()
      setApplyingPatch(false)
      setViewMode("preview")
      lastPatchFailureRef.current = null

      const lostSummary = data.lostPriceTokens.length > 0
        ? `Protected prices: ${data.lostPriceTokens.join(", ")}`
        : `${data.lostTokens.length} text items would have been lost`
      toast.warning("Content protected", {
        description: `${lostSummary}. Your previous version was kept. Try rephrasing to be more specific about what to change.`,
      })
      finalizeAssistantMessage(
        `I kept your previous version because ${data.lostTokens.length} text items would have been lost. ` +
        `This was a style-only change, so I protected your existing content. ` +
        `To change both style and content, include specific content instructions in your prompt.`
      )
      // ponytail: dequeue queued prompt on terminal content-wipe (Bug #5).
      dequeueAndSend()
    },
    onHexWarning: (data) => {
      toast.warning("Color constraint", {
        description: data.message,
      })
    },
    onCancel: () => {
      const activeRequest = activeAiRequestRef.current
      resetActiveAiRequest()
      lastFailedRequestRef.current = null
      recoveryInFlightRef.current = false
      promptScopeRecoveryInFlightRef.current = false
      scopeRecoveryAttemptsRef.current = 0
      setPendingRecovery(null)
      setDraftAiOutput("")
      if (activeRequest.isFollowUp || activeRequest.recoveryMode) {
        restorePreservedHtml()
      }
      setApplyingPatch(false)
      setViewMode("preview")
      lastPatchFailureRef.current = null
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]
        if (!lastMessage || lastMessage.role !== "assistant" || !lastMessage.isThinking) {
          return prev
        }

        // Auto-collapse the thinking panel on cancel.
        setExpandedThinkingIds((ids) => {
          if (!ids.has(lastMessage.id)) return ids
          const next = new Set(ids)
          next.delete(lastMessage.id)
          return next
        })

        return prev.map((message, index) =>
          index === prev.length - 1
            ? {
                ...message,
                isThinking: false,
                content: message.content || "Generation cancelled.",
                progressLabel: undefined,
              }
            : message,
        )
      })
      toast.info("Generation cancelled", {
        description: "The current generation was stopped.",
      })
      // ponytail: dequeue queued prompt on cancel (Bug #5).
      dequeueAndSend()
    },
    onProjectNameUpdate: (name) => {
      const normalizedName = normalizeProjectName(name)
      setProjectName(normalizedName)
      saveProjectToMongo(htmlContentRef.current, normalizedName)
    },
    onPatch: (filePath, search, replace) => {
      const activeRequest = activeAiRequestRef.current
      if (activeRequest.isFollowUp && !isPatchRepairRecoveryMode(activeRequest.recoveryMode)) {
        lastPatchFailureRef.current = {
          kind: "response-validation-failed",
          detail: "Expected a complete HTML document for the follow-up update.",
        }
        return false
      }

      const normalizedPath = filePath.trim().replace(/^\.?\//, "")
      if (normalizedPath !== "index.html") {
        lastPatchFailureRef.current = {
          kind: "unsupported-target",
          filePath: normalizedPath || filePath.trim() || "unknown file",
        }
        console.warn(`Unsupported patch target: ${filePath}`)
        return false
      }

      // Use the ref for synchronous access to current HTML
      const parser = new StreamParser({})
      const result = parser.applyPatch(htmlContentRef.current, search, replace, filePath)
      
      if (result.success) {
        const nextHtml = result.content.trim()
        if (!isCompleteHtmlDocument(nextHtml)) {
          lastPatchFailureRef.current = {
            kind: "invalid-document",
            filePath: normalizedPath,
            detail: result.tier,
          }
          console.warn(`Rejected incomplete HTML patch for ${filePath}`)
          return false
        }

        commitHtmlContentUpdate(nextHtml)
        return true
      } else {
        lastPatchFailureRef.current = {
          kind: "search-replace-failed",
          filePath: normalizedPath,
          detail: result.error,
        }
        console.warn(`Patch failed for ${filePath}: ${result.error}`)
        return false
      }
    },
    onComplete: (result) => {
      const activeRequest = activeAiRequestRef.current
      const requestRecoveryMode = result.recoveryMode ?? activeRequest.recoveryMode
      const usesPatchRepairFlow = isPatchRepairRecoveryMode(requestRecoveryMode)
      resetActiveAiRequest()
      // ponytail: clear failed request on successful completion (Bug #2).
      lastFailedRequestRef.current = null

      const { rawContent, extractedHtml, failedFiles, recoveryMode, incompletePatches, validationError } = result
      const isFollowUp = activeRequest.isFollowUp
      const hasPatchFailures = !!failedFiles?.length
      const hasCompleteHtml = isCompleteHtmlDocument(extractedHtml)
      const hasUnexpectedFullDocument = usesPatchRepairFlow && hasCompleteHtml
      const preservedHtml = selectStableHtmlDocument(
        [requestStableHtmlRef.current, lastAppliedHtml.current, htmlContentRef.current, htmlContent],
        EMPTY_HTML,
      )
      const hasCommittedUpdatedHtml =
        isCompleteHtmlDocument(htmlContentRef.current) && htmlContentRef.current.trim() !== preservedHtml
      const expectsFullDocument = !usesPatchRepairFlow
      const looksLikeHtmlResponse = /<!DOCTYPE|<html\b/i.test(rawContent)
      const missingExpectedFullDocument =
        expectsFullDocument && !hasCompleteHtml && (looksLikeHtmlResponse || !hasCommittedUpdatedHtml)
      const finalHtmlForValidation = hasCompleteHtml ? extractedHtml : htmlContentRef.current
      const promptScopeValidation = validatePromptScope(lastUserPromptRef.current, finalHtmlForValidation)
      const hasPromptScopeIssues = !promptScopeValidation.valid
      const canRetryPromptScope = hasPromptScopeIssues && scopeRecoveryAttemptsRef.current < MAX_SCOPE_RECOVERY_ATTEMPTS
      const hasProtocolIssues = Boolean(validationError) || (incompletePatches || 0) > 0
      const shouldRecoverForOutputIssues =
        hasUnexpectedFullDocument ||
        missingExpectedFullDocument ||
        ((hasPatchFailures || hasProtocolIssues) && !hasCompleteHtml)
      const shouldRecoverForPromptScope = hasPromptScopeIssues && canRetryPromptScope
      const shouldRecover = shouldRecoverForOutputIssues || shouldRecoverForPromptScope
      const scopeFailureMessage = formatMissingScopeMessage(promptScopeValidation.missingRequirements)
      const followUpOutputFailureMessage = "Could not complete the update automatically. The previous page was kept."

      if (isFollowUp && shouldRecoverForOutputIssues && !recoveryMode) {
        restorePreservedHtml(preservedHtml)
        recoveryInFlightRef.current = false
        promptScopeRecoveryInFlightRef.current = false
        scopeRecoveryAttemptsRef.current = 0
        setPendingRecovery(null)
        setDraftAiOutput("")
        setApplyingPatch(false)
        setViewMode("preview")
        finalizeAssistantMessage(followUpOutputFailureMessage)
        return
      }

      if (shouldRecover && !recoveryMode) {
        const failedFileSummary = (failedFiles || []).join(", ") || "index.html"
        const originalPrompt = lastUserPromptRef.current || "the requested changes"
        const nextRecoveryMode = resolveRecoveryMode(isFollowUp)
        const recoveryBaseHtml = hasCompleteHtml ? extractedHtml : preservedHtml
        const recoveryReason = hasPromptScopeIssues
          ? `Missing requested UI scope: ${promptScopeValidation.missingRequirements.join(", ")}`
          : hasUnexpectedFullDocument
            ? "Received a full-document response for a targeted follow-up edit"
          : missingExpectedFullDocument
            ? "Expected a complete HTML document but did not receive one"
          : validationError
            ? validationError
            : incompletePatches
              ? `Received ${incompletePatches} incomplete patch block${incompletePatches > 1 ? "s" : ""}`
              : `Patch update failed for ${failedFileSummary}`
        const recoveryPrompt = hasPromptScopeIssues
          ? buildPromptScopeRecoveryPrompt(originalPrompt, promptScopeValidation.missingRequirements)
          : originalPrompt

        if (hasPromptScopeIssues && hasCompleteHtml) {
          commitHtmlContentUpdate(extractedHtml)
          scopeRecoveryAttemptsRef.current += 1
        }

        setPendingRecovery({
          prompt: recoveryPrompt,
          failedFiles: failedFiles || [],
          model: state.selectedModel,
          reason: recoveryReason,
          baseHtml: recoveryBaseHtml,
          selectedElement: extractSelectedElementHtmlFromContent(recoveryBaseHtml, selectedElement?.id),
          isPromptScopeRecovery: hasPromptScopeIssues,
          mode: nextRecoveryMode,
        })

        if (hasPromptScopeIssues) {
          updateAssistantProgress({
            stage: "continuing",
            message: "Refining update...",
            partNumber: (result.meta?.totalParts ?? 1) + 1,
            continuationCount: scopeRecoveryAttemptsRef.current,
            totalContentLength: finalHtmlForValidation.length,
            thresholdReached: result.meta?.thresholdReached,
          })
        } else {
          updateAssistantProgress({
            stage: "continuing",
            message: "Refining update...",
            partNumber: (result.meta?.totalParts ?? 1) + 1,
            continuationCount: scopeRecoveryAttemptsRef.current,
            totalContentLength: finalHtmlForValidation.length,
            thresholdReached: result.meta?.thresholdReached,
          })
        }

        setDraftAiOutput("")
        setViewMode("code")
        return
      }

      if (shouldRecoverForPromptScope && recoveryMode && hasCompleteHtml && !hasUnexpectedFullDocument) {
        const originalPrompt = lastUserPromptRef.current || "the requested changes"
        const recoveryPrompt = buildPromptScopeRecoveryPrompt(
          originalPrompt,
          promptScopeValidation.missingRequirements,
        )
        const nextRecoveryMode = resolveRecoveryMode(isFollowUp)

        commitHtmlContentUpdate(extractedHtml)
        scopeRecoveryAttemptsRef.current += 1
        setPendingRecovery({
          prompt: recoveryPrompt,
          failedFiles: failedFiles || [],
          model: state.selectedModel,
          reason: `Missing requested UI scope: ${promptScopeValidation.missingRequirements.join(", ")}`,
          baseHtml: extractedHtml,
          selectedElement: extractSelectedElementHtmlFromContent(extractedHtml, selectedElement?.id),
          isPromptScopeRecovery: true,
          mode: nextRecoveryMode,
        })

        updateAssistantProgress({
          stage: "continuing",
          message: "Refining update...",
          partNumber: (result.meta?.totalParts ?? 1) + 1,
          continuationCount: scopeRecoveryAttemptsRef.current,
          totalContentLength: extractedHtml.length,
          thresholdReached: result.meta?.thresholdReached,
        })

        setDraftAiOutput("")
        setViewMode("code")
        return
      }

      if (shouldRecover && recoveryMode) {
        recoveryInFlightRef.current = false
        promptScopeRecoveryInFlightRef.current = false
        setPendingRecovery(null)
        setDraftAiOutput("")
        const preservedLayoutMessage = getTargetedRecoveryFailureMessage(validationError)
        restorePreservedHtml(preservedHtml)
        setApplyingPatch(false)
        setViewMode("preview")
        if (!hasPromptScopeIssues && !isFollowUp) {
          toast.error("Update failed", {
            description: isFullDocumentRecoveryMode(requestRecoveryMode)
              ? FULL_DOCUMENT_RECOVERY_FAILURE_MESSAGE
              : preservedLayoutMessage,
          })
        }
        finalizeAssistantMessage(
          isFollowUp
            ? followUpOutputFailureMessage
            : hasPromptScopeIssues
              ? `${scopeFailureMessage} Try a more explicit follow-up request if you want another pass.`
              : isFullDocumentRecoveryMode(requestRecoveryMode)
                ? FULL_DOCUMENT_RECOVERY_FAILURE_MESSAGE
                : preservedLayoutMessage,
        )
        return
      }

      if (hasPromptScopeIssues && hasCompleteHtml && scopeRecoveryAttemptsRef.current > 0) {
        commitHtmlContentUpdate(extractedHtml)
      }

      if (hasCompleteHtml) {
        commitHtmlContentUpdate(extractedHtml)

        if (hasPatchFailures) {
          toast.success("Update applied", {
            description: "Applied a full-document update to keep the editor in sync.",
          })
        }
      } else {
        if ((!isFollowUp || extractedHtml) && extractedHtml && (extractedHtml.includes("<!DOCTYPE") || extractedHtml.includes("<html"))) {
          commitHtmlContentUpdate(extractedHtml)
        }
      }

      recoveryInFlightRef.current = false
      promptScopeRecoveryInFlightRef.current = false
      scopeRecoveryAttemptsRef.current = 0
      setPendingRecovery(null)
      lastPatchFailureRef.current = null
      const assistantMessageId = activeRequest.assistantMessageId
      const finalHtml = hasCompleteHtml ? extractedHtml : htmlContentRef.current
      const fallbackSummary = isFollowUp
        ? buildFollowUpSummary(lastUserPromptRef.current, finalHtml)
        : buildGenerationSummary({
            prompt: lastUserPromptRef.current,
            html: finalHtml,
          })
      const fallbackAssistantMessage = hasPromptScopeIssues && hasCompleteHtml
        ? `${fallbackSummary}\nScope note: ${scopeFailureMessage} The latest complete UI was kept in the editor.`
        : fallbackSummary

      finalizeGenerationSuccess()

      if (!assistantMessageId) {
        finalizeAssistantMessage(fallbackAssistantMessage)
        return
      }

      setMessages((prev) => prev.map((message) =>
        message.id === assistantMessageId && message.role === "assistant"
          ? { ...message, isThinking: true, progressLabel: "Writing response..." }
          : message,
      ))

      void (async () => {
        const assistantMessage = await requestGenerationAssistantMessage({
          prompt: lastUserPromptRef.current,
          html: finalHtml,
          isFollowUp,
          model: state.selectedModel,
        })

        const resolvedSummary = assistantMessage
          ? hasPromptScopeIssues && hasCompleteHtml
            ? `${assistantMessage}\n\nScope note: ${scopeFailureMessage} The latest complete UI was kept in the editor.`
            : assistantMessage
          : fallbackAssistantMessage

        finalizeAssistantMessage(resolvedSummary, assistantMessageId)
        // ponytail: dequeue queued prompt on terminal state (Bug #5).
        // Only fires after successful completion (not during recovery).
        dequeueAndSend()
      })()
    },
    onError: (error) => {
      const activeRequest = activeAiRequestRef.current
      const activeRecoveryMode = activeRequest.recoveryMode
      // ponytail: store failed request for retry (Bug #2). Reuses
      // requestStableHtmlRef so every retry starts from the same baseline.
      if (activeRequest.isFollowUp && lastUserPromptRef.current) {
        lastFailedRequestRef.current = {
          prompt: lastUserPromptRef.current,
          model: state.selectedModel,
          stableHtml: requestStableHtmlRef.current,
        }
      }
      resetActiveAiRequest()
      const isRecoveryFailure = recoveryInFlightRef.current
      const isPromptScopeRecoveryFailure = promptScopeRecoveryInFlightRef.current
      const shouldRestorePreviousPage = activeRequest.isFollowUp || Boolean(activeRecoveryMode)
      const targetedFailureMessage = getTargetedRecoveryFailureMessage(error.message)
      recoveryInFlightRef.current = false
      promptScopeRecoveryInFlightRef.current = false
      scopeRecoveryAttemptsRef.current = 0
      setPendingRecovery(null)
      setDraftAiOutput("")
      if (shouldRestorePreviousPage) {
        restorePreservedHtml()
      }
      setApplyingPatch(false)
      setViewMode("preview")
      if (!(isRecoveryFailure && isPromptScopeRecoveryFailure) && !activeRequest.isFollowUp) {
        const errorReason = (error as Error & { reason?: string }).reason
        const description = isRecoveryFailure
          ? isFullDocumentRecoveryMode(activeRecoveryMode)
            ? FULL_DOCUMENT_RECOVERY_FAILURE_MESSAGE
            : targetedFailureMessage
          : shouldRestorePreviousPage
            ? `${error.message || "Something went wrong while generating code."} The previous page was restored.`
            : error.message || "Something went wrong while generating code. Please try again."
        toast.error(isRecoveryFailure ? "Update failed" : "Generation failed", {
          description: errorReason ? `${description} (${errorReason})` : description,
        })
      }
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === "assistant") {
          const errorReason = (error as Error & { reason?: string }).reason
          const baseContent = isRecoveryFailure
            ? isPromptScopeRecoveryFailure
              ? "Could not finish expanding the requested UI automatically. The latest complete result was kept in the editor."
              : isFullDocumentRecoveryMode(activeRecoveryMode)
                ? FULL_DOCUMENT_RECOVERY_FAILURE_MESSAGE
                : targetedFailureMessage
            : activeRequest.isFollowUp
              ? "Could not complete the update automatically. The previous page was kept."
            : shouldRestorePreviousPage
              ? `Error: ${error.message}. The previous page was restored.`
              : `Error: ${error.message}`
          // ponytail: surface the reason from the server (Bug #2) and add retry hint.
          const reasonSuffix = errorReason ? ` Reason: ${errorReason}.` : ""
          const retryHint = activeRequest.isFollowUp && lastFailedRequestRef.current
            ? " You can retry the same prompt."
            : ""
          const finalContent = `${baseContent}${reasonSuffix}${retryHint}`

          // Auto-collapse the thinking panel on error.
          setExpandedThinkingIds((ids) => {
            if (!ids.has(lastMessage.id)) return ids
            const next = new Set(ids)
            next.delete(lastMessage.id)
            return next
          })

          return prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, isThinking: false, content: finalContent, progressLabel: undefined }
              : m
          )
        }
        return prev
      })
      // ponytail: dequeue queued prompt on terminal failure (Bug #5).
      // Only fires on hard failure, not during intermediate recovery.
      if (!isRecoveryFailure && !pendingRecovery) {
        dequeueAndSend()
      }
    },
  })

  // Auto-save to MongoDB when content changes (debounced)
  useEffect(() => {
    if (!isRestored || isLoadingProject || isGenerating) return
    if (!projectId || projectId === "new") return
    if (!hasUnsavedChanges) return

    debouncedSave(htmlContent)
  }, [htmlContent, hasUnsavedChanges, isGenerating, isRestored, isLoadingProject, projectId, debouncedSave])

  useEffect(() => {
    if (!pendingRecovery || isGenerating) return

    recoveryInFlightRef.current = true
    const recoveryRequest = pendingRecovery
    promptScopeRecoveryInFlightRef.current = Boolean(recoveryRequest.isPromptScopeRecovery)
    setPendingRecovery(null)
    const activeAssistantMessage = messagesRef.current[messagesRef.current.length - 1]

    setApplyingPatch(true)
    setViewMode("code")
    setDraftAiOutput("")
    activeAiRequestRef.current = {
      isFollowUp: true,
      recoveryMode: recoveryRequest.mode,
      assistantMessageId: activeAssistantMessage?.role === "assistant" ? activeAssistantMessage.id : undefined,
    }

    void sendAIMessage({
      prompt: recoveryRequest.prompt,
      currentHtml: recoveryRequest.baseHtml ?? htmlContentRef.current,
      selectedElement: recoveryRequest.selectedElement,
      isFollowUp: true,
      recoveryMode: recoveryRequest.mode,
      model: recoveryRequest.model ?? state.selectedModel,
      primaryColor: state.primaryColor,
      secondaryColor: state.secondaryColor,
      theme: state.theme,
    }).catch(() => {
      // Error handling is managed by useAIChat onError callback.
    })
  }, [
    isGenerating,
    pendingRecovery,
    sendAIMessage,
    setApplyingPatch,
    state.selectedModel,
    state.primaryColor,
    state.secondaryColor,
    state.theme,
  ])

  // Handle sending a message
  const startGeneration = useCallback(
    async ({
      message,
      model,
      useExistingUserMessage = false,
      images,
    }: {
      message: string
      model?: string
      useExistingUserMessage?: boolean
      images?: string[]
    }) => {
      const trimmedMessage = message.trim()
      if (!trimmedMessage) return

      setPendingDesignDiscovery(null)

      recoveryInFlightRef.current = false
      promptScopeRecoveryInFlightRef.current = false
      scopeRecoveryAttemptsRef.current = 0
      lastPatchFailureRef.current = null
      setPendingRecovery(null)

      requestStableHtmlRef.current = selectStableHtmlDocument(
        [htmlContentRef.current, lastAppliedHtml.current, htmlContent],
        EMPTY_HTML,
      )

      // ponytail: snapshot stable preview ref for follow-ups (Bug #3).
      // During follow-up generation, the preview shows this committed HTML,
      // never the streaming draft.
      stablePreviewHtmlRef.current = requestStableHtmlRef.current

      if (isGenerating) {
        cancelAI()
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      if (!session) {
        showSignIn()
        return
      }

      const historySource = useExistingUserMessage ? messages.slice(0, -1) : messages
      const isFollowUp = historySource.length > 0
      const shouldApplyFallbackName = !isFollowUp && isDefaultProjectName(projectName)
      if (shouldApplyFallbackName) {
        const fallbackName = deriveProjectNameFromPrompt(trimmedMessage)
        if (!isDefaultProjectName(fallbackName)) {
          setProjectName(fallbackName)
          saveProjectToMongo(htmlContentRef.current, fallbackName)
        }
      }

      await createCheckpoint(`Before AI: ${trimmedMessage.slice(0, 120)}`, {
        silent: true,
        kind: "auto",
        trigger: "before-ai",
      })

      const assistantMessage: Message = {
        id: createEditorEntityId("assistant"),
        content: "",
        role: "assistant",
        timestamp: new Date(),
        isThinking: true,
        progressLabel: "Analyzing request...",
      }

      if (useExistingUserMessage) {
        setMessages((prev) => {
          const nextMessages = [...prev]
          const lastMessage = nextMessages[nextMessages.length - 1]

          if (lastMessage?.role === "user" && lastMessage.content !== trimmedMessage) {
            nextMessages[nextMessages.length - 1] = {
              ...lastMessage,
              content: trimmedMessage,
              images,
            }
          }

          nextMessages.push(assistantMessage)
          return nextMessages
        })
      } else {
        const userMessage: Message = {
          id: createEditorEntityId("user"),
          content: trimmedMessage,
          role: "user",
          timestamp: new Date(),
          images,
        }

        setMessages((prev) => [...prev, userMessage, assistantMessage])
        saveMessageToMongo({ role: "user", content: trimmedMessage, images })
      }

      lastUserPromptRef.current = trimmedMessage
      setViewMode("code")
      setDraftAiOutput("")

      setApplyingPatch(true)
      const conversationHistory = historySource
        .filter((entry) => entry.content.trim().length > 0)
        .slice(-6)
        .map((entry) => ({
          role: entry.role,
          content: entry.content.trim(),
        }))
      
      let selectedElementHtml = undefined
      if (isFollowUp && selectedElement) {
        selectedElementHtml = extractSelectedElementHtmlFromContent(htmlContentRef.current, selectedElement.id)
        if (!selectedElementHtml) {
          setSelectedElement(null)
          toast.info("Selected element unavailable", {
            description: "The previously selected element no longer exists in the current HTML. Applying the request globally instead.",
          })
        }
      }

      try {
        activeAiRequestRef.current = {
          isFollowUp,
          assistantMessageId: assistantMessage.id,
        }

        // ── Extract design tokens from current HTML (Bug #8) ──
        const currentDesignTokens: DesignTokens = isFollowUp && htmlContentRef.current
          ? extractDesignTokensFromHtml(htmlContentRef.current)
          : {}

        // ── Build restore candidates from version history (Bug #3) ──
        const restoreCandidates = isFollowUp
          ? versions
              .filter((v) => v.htmlContent && v.htmlContent.trim().length > 100)
              .slice(0, 3)
              .map((v) => v.htmlContent)
          : undefined

        await sendAIMessage({
          prompt: trimmedMessage,
          currentHtml: isFollowUp ? htmlContentRef.current : undefined,
          selectedElement: selectedElementHtml,
          isFollowUp,
          model: model ?? state.selectedModel,
          primaryColor: state.primaryColor,
          secondaryColor: state.secondaryColor,
          theme: state.theme,
          conversationHistory,
          images,
          designTokens: currentDesignTokens,
          restoreCandidates,
        })
      } catch {
        // Error handling is managed by useAIChat onError callback.
      }
    },
    [
      session,
      showSignIn,
      createCheckpoint,
      sendAIMessage,
      cancelAI,
      isGenerating,
      messages.length,
      messages,
      selectedElement,
      extractSelectedElementHtmlFromContent,
      state.selectedModel,
      state.primaryColor,
      state.secondaryColor,
      state.theme,
      htmlContent,
      projectName,
      saveMessageToMongo,
      toast,
    ]
  )

  const handleSend = useCallback(
    async (message: string, model?: string, images?: Array<{ dataUrl: string }>) => {
      const trimmedMessage = message.trim()
      if (!trimmedMessage) {
        return
      }

      // ponytail: clear failed request on new send (Bug #2).
      lastFailedRequestRef.current = null

      // ponytail: queue prompt if already generating (Bug #5).
      // Only one queued prompt at a time; auto-sends on terminal states.
      if (isGenerating) {
        queuedPromptRef.current = { prompt: trimmedMessage, model, images }
        setQueuedPrompt(trimmedMessage)
        toast.info("Queued", {
          description: "Will run after the current generation finishes.",
        })
        return
      }

      if (pendingDesignDiscovery?.isLoading || pendingDesignDiscovery?.isSubmitting) {
        return
      }

      const imageUrls = images?.map((img) => img.dataUrl) ?? []

      // Block non-vision models when images are attached
      if (imageUrls.length > 0 && !isVisionCapableModel(model ?? state.selectedModel)) {
        toast.error("Pick a vision-capable model", {
          description: "The selected model does not support image input. Switch to Gemini, Claude, GPT, or another vision-capable model.",
        })
        return
      }

      if (messagesRef.current.length > 0) {
        clearPendingDesignDiscovery()
        await startGeneration({ message: trimmedMessage, model, images: imageUrls })
        return
      }

      if (!session) {
        showSignIn()
        return
      }

      // Skip design-discovery when images are attached — the LLM needs to see the images directly
      if (imageUrls.length > 0) {
        await startGeneration({ message: trimmedMessage, model, images: imageUrls })
        return
      }

      const requestToken = designDiscoveryRequestRef.current + 1
      designDiscoveryRequestRef.current = requestToken

      setPendingDesignDiscovery({
        prompt: trimmedMessage,
        model,
        reasoning: "Checking whether a short design discovery pass would materially improve the prompt before generation.",
        questions: [],
        answers: {},
        currentQuestionIndex: 0,
        isLoading: true,
        isSubmitting: false,
      })

      try {
        const response = await fetch("/api/ai/design-discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmedMessage,
            model: model ?? state.selectedModel,
          }),
        })

        if (requestToken !== designDiscoveryRequestRef.current) {
          return
        }

        if (response.status === 401) {
          clearPendingDesignDiscovery()
          showSignIn()
          return
        }

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.error || "Failed to evaluate prompt detail")
        }

        if (!data?.needsClarification || !Array.isArray(data.questions) || data.questions.length === 0) {
          clearPendingDesignDiscovery()
          await startGeneration({ message: trimmedMessage, model })
          return
        }

        setPendingDesignDiscovery({
          prompt: trimmedMessage,
          model,
          reasoning:
            typeof data.reasoning === "string" && data.reasoning.trim()
              ? data.reasoning.trim()
              : "A few high-impact design details are still missing.",
          questions: data.questions,
          answers: {},
          currentQuestionIndex: 0,
          isLoading: false,
          isSubmitting: false,
        })
      } catch (error) {
        if (requestToken === designDiscoveryRequestRef.current) {
          clearPendingDesignDiscovery()
        }

        toast.info("Skipping discovery", {
          description:
            error instanceof Error
              ? error.message
              : "Continuing directly to generation.",
        })

        await startGeneration({ message: trimmedMessage, model })
      }
    },
    [clearPendingDesignDiscovery, pendingDesignDiscovery?.isLoading, pendingDesignDiscovery?.isSubmitting, session, showSignIn, startGeneration, state.selectedModel, toast]
  )

  // ponytail: retry the last failed reprompt from the same stable baseline (Bug #2).
  const handleRetryFailedPrompt = useCallback(() => {
    const failed = lastFailedRequestRef.current
    if (!failed) return
    lastFailedRequestRef.current = null

    // Restore the stable HTML that was current when the failure occurred
    // so the retry starts from the exact same DOM baseline.
    restorePreservedHtml(failed.stableHtml)

    toast.info("Retrying...", {
      description: "Resending the same prompt against the original page.",
    })

    void startGeneration({
      message: failed.prompt,
      model: failed.model,
    })
  }, [restorePreservedHtml, startGeneration, toast])

  // ponytail: dequeue and auto-send queued prompt on terminal states (Bug #5).
  // Must NOT fire during intermediate recovery states — only on
  // rolledBack, completed, or failedTerminal.
  const dequeueAndSend = useCallback(() => {
    const queued = queuedPromptRef.current
    if (!queued) return
    queuedPromptRef.current = null
    setQueuedPrompt(null)

    // Small delay to let the current state settle before starting the next.
    setTimeout(() => {
      void handleSend(queued.prompt, queued.model, queued.images)
    }, 100)
  }, [handleSend])

  const cancelQueuedPrompt = useCallback(() => {
    queuedPromptRef.current = null
    setQueuedPrompt(null)
  }, [])

  const completeDesignDiscovery = useCallback(
    async (
      discoveryState: PendingDesignDiscovery,
      answers: Record<string, DesignDiscoveryAnswer | undefined>,
    ) => {
      const compiledPrompt = composePromptWithDiscoveryAnswers(
        discoveryState.prompt,
        Object.values(answers).filter((answer): answer is DesignDiscoveryAnswer => Boolean(answer)),
      )

      clearPendingDesignDiscovery()
      await startGeneration({
        message: compiledPrompt,
        model: discoveryState.model,
      })
    },
    [clearPendingDesignDiscovery, startGeneration],
  )

  const handleDesignDiscoveryOptionSelect = useCallback(async (
    question: DesignDiscoveryQuestion,
    optionLabel: string,
  ) => {
    if (!pendingDesignDiscovery || pendingDesignDiscovery.isSubmitting) {
      return
    }

    const nextAnswers = {
      ...pendingDesignDiscovery.answers,
      [question.id]: {
        questionId: question.id,
        focusArea: question.focusArea,
        question: question.question,
        answer: optionLabel,
        source: "option" as const,
      },
    }

    if (pendingDesignDiscovery.currentQuestionIndex >= pendingDesignDiscovery.questions.length - 1) {
      setPendingDesignDiscovery((current) => current ? { ...current, answers: nextAnswers, isSubmitting: true } : current)
      await completeDesignDiscovery(pendingDesignDiscovery, nextAnswers)
      return
    }

    setPendingDesignDiscovery((current) => current ? {
      ...current,
      answers: nextAnswers,
      currentQuestionIndex: Math.min(current.currentQuestionIndex + 1, current.questions.length - 1),
    } : current)
  }, [completeDesignDiscovery, pendingDesignDiscovery])

  const handleDesignDiscoveryCustomAnswerChange = useCallback((question: DesignDiscoveryQuestion, value: string) => {
    setPendingDesignDiscovery((current) => {
      if (!current) {
        return current
      }

      const trimmedValue = value.trim()
      const nextAnswers = { ...current.answers }

      if (!trimmedValue) {
        delete nextAnswers[question.id]
      } else {
        nextAnswers[question.id] = {
          questionId: question.id,
          focusArea: question.focusArea,
          question: question.question,
          answer: value,
          source: "custom",
        }
      }

      return {
        ...current,
        answers: nextAnswers,
      }
    })
  }, [])

  const handleDesignDiscoveryNext = useCallback(async () => {
    if (!pendingDesignDiscovery || pendingDesignDiscovery.isSubmitting) {
      return
    }

    const currentQuestion = pendingDesignDiscovery.questions[pendingDesignDiscovery.currentQuestionIndex]
    if (!currentQuestion) {
      return
    }

    const currentAnswer = pendingDesignDiscovery.answers[currentQuestion.id]
    if (!currentAnswer || currentAnswer.source === "skip" || !currentAnswer.answer.trim()) {
      return
    }

    if (pendingDesignDiscovery.currentQuestionIndex >= pendingDesignDiscovery.questions.length - 1) {
      setPendingDesignDiscovery((current) => current ? { ...current, isSubmitting: true } : current)
      await completeDesignDiscovery(pendingDesignDiscovery, pendingDesignDiscovery.answers)
      return
    }

    setPendingDesignDiscovery((current) => current ? {
      ...current,
      currentQuestionIndex: Math.min(current.currentQuestionIndex + 1, current.questions.length - 1),
    } : current)
  }, [completeDesignDiscovery, pendingDesignDiscovery])

  const handleDesignDiscoveryPrevious = useCallback(() => {
    setPendingDesignDiscovery((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        currentQuestionIndex: Math.max(current.currentQuestionIndex - 1, 0),
      }
    })
  }, [])

  const handleDesignDiscoverySkip = useCallback(async () => {
    if (!pendingDesignDiscovery || pendingDesignDiscovery.isSubmitting) {
      return
    }

    const currentQuestion = pendingDesignDiscovery.questions[pendingDesignDiscovery.currentQuestionIndex]
    if (!currentQuestion) {
      return
    }

    const nextAnswers = {
      ...pendingDesignDiscovery.answers,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        focusArea: currentQuestion.focusArea,
        question: currentQuestion.question,
        answer: "",
        source: "skip" as const,
      },
    }

    if (pendingDesignDiscovery.currentQuestionIndex >= pendingDesignDiscovery.questions.length - 1) {
      setPendingDesignDiscovery((current) => current ? { ...current, answers: nextAnswers, isSubmitting: true } : current)
      await completeDesignDiscovery(pendingDesignDiscovery, nextAnswers)
      return
    }

    setPendingDesignDiscovery((current) => current ? {
      ...current,
      answers: nextAnswers,
      currentQuestionIndex: Math.min(current.currentQuestionIndex + 1, current.questions.length - 1),
    } : current)
  }, [completeDesignDiscovery, pendingDesignDiscovery])

  // Handle random prompt
  const handleRandomPrompt = useCallback(() => {
    const randomPrompt = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)]
    return randomPrompt
  }, [])

  // Handle initial prompt from landing page
  useEffect(() => {
    const fallbackOrphanedPrompt =
      messages.length === 1 &&
      messages[0]?.role === "user" &&
      !hasGeneratedOnce
        ? messages[0].content.trim()
        : ""
    const promptToAutoStart = initialPrompt?.trim() || fallbackOrphanedPrompt
    const hasRetryableOrphanedInitialUserMessage =
      messages.length === 1 &&
      messages[0]?.role === "user" &&
      messages[0]?.content.trim() === promptToAutoStart &&
      !hasGeneratedOnce &&
      !isGenerating

    if (
      !isRestored ||
      !promptToAutoStart ||
      (hasProcessedInitialPrompt.current && !hasRetryableOrphanedInitialUserMessage) ||
      isLoadingProject
    ) {
      return
    }

    if (sessionStatus === "loading") {
      return
    }

    const hasOrphanedInitialUserMessage =
      hasRetryableOrphanedInitialUserMessage

    if (messages.length > 0 && !hasOrphanedInitialUserMessage) {
      return
    }

    if (!session) {
      hasProcessedInitialPrompt.current = true
      showSignIn()
      return
    }

    if (initialPromptStartTimerRef.current !== null) {
      window.clearTimeout(initialPromptStartTimerRef.current)
    }

    initialPromptStartTimerRef.current = window.setTimeout(() => {
      initialPromptStartTimerRef.current = null
      hasProcessedInitialPrompt.current = true
      void startGeneration({
        message: promptToAutoStart,
        model: initialModel,
        images: initialImages,
        useExistingUserMessage: hasOrphanedInitialUserMessage,
      })
    }, 0)

    return () => {
      if (initialPromptStartTimerRef.current !== null) {
        window.clearTimeout(initialPromptStartTimerRef.current)
        initialPromptStartTimerRef.current = null
      }
    }
  }, [hasGeneratedOnce, initialPrompt, initialModel, isGenerating, isLoadingProject, isRestored, messages, session, sessionStatus, showSignIn, startGeneration])

  // Handle code editor changes
  const handleCodeChange = useCallback((value: string) => {
    commitHtmlContentUpdate(value)
  }, [commitHtmlContentUpdate])

  const handleViewModeChange = useCallback((nextMode: ViewMode) => {
    if (nextMode === viewMode) {
      return
    }

    if (viewMode === "code" && nextMode !== "code") {
      const latestHtml = htmlContentRef.current
      if (latestHtml && latestHtml !== htmlContent) {
        commitHtmlContentUpdate(latestHtml)
      }
    }

    setViewMode(nextMode)
  }, [commitHtmlContentUpdate, htmlContent, viewMode])

  // Handle reset chat
  const handleResetChat = useCallback(async () => {
    if (!window.confirm("Are you sure you want to clear the chat history? This cannot be undone.")) {
      return
    }

    clearPendingDesignDiscovery()
    setMessages([])
    
    if (projectId && projectId !== "new" && session?.user?.id) {
      try {
        await fetch(`/api/projects/${projectId}/messages`, {
          method: "DELETE",
        })
        toast.success("Chat history cleared")
      } catch (error) {
        console.error("Failed to clear chat history:", error)
        toast.error("Failed to clear chat history")
      }
    }
  }, [clearPendingDesignDiscovery, projectId, session?.user?.id, toast])

  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const handleExport = useCallback(() => {
    setIsExportModalOpen(true)
  }, [])

  const handleConfirmExport = useCallback(() => {
    const safeFileName = sanitizeFileName(projectName)

    try {
      if (exportFormat === "html") {
        downloadFile(htmlContent, `${safeFileName}.html`, "text/html")
      } else if (exportFormat === "react") {
        const reactComponent = convertHtmlToReactComponent(htmlContent, projectName)
        downloadFile(reactComponent, `${safeFileName}.tsx`, "text/plain")
      } else {
        const prompt = generateExportPrompt(htmlContent, {
          primaryColor: state.primaryColor,
          secondaryColor: state.secondaryColor,
          theme: state.theme,
        })
        navigator.clipboard.writeText(prompt)
        toast.success("Prompt copied", {
          description: "Paste this prompt in your favorite AI agent to recreate this UI.",
        })
        setIsExportModalOpen(false)
        return
      }

      toast.success("Export complete", {
        description: exportFormat === "react" ? "Downloaded React component (.tsx)." : "Downloaded HTML file.",
      })
      setIsExportModalOpen(false)
    } catch (error) {
      console.error("Export failed:", error)
      toast.error("Export failed", {
        description: "Unable to export the current project.",
      })
    }
  }, [downloadFile, exportFormat, htmlContent, projectName, state, toast])

  const handleSaveCheckpoint = useCallback(async () => {
    // ponytail: explicit Save creates the project if it doesn't exist yet
    if (!createdProjectIdRef.current && projectId === "new" && session?.user?.id) {
      const effectiveId = await ensureProjectCreated(htmlContentRef.current, projectName)
      if (!effectiveId) return
    }

    const description = viewMode === "design"
      ? "Manual checkpoint (design mode)"
      : "Manual checkpoint"

    await createCheckpoint(description, {
      kind: "manual",
      trigger: "manual-save",
    })
  }, [createCheckpoint, ensureProjectCreated, projectId, projectName, session?.user?.id, viewMode])

  const applyVersionSnapshot = useCallback((version: HistoryVersion) => {
    if (!version || !canUseStableProjectHtml(version.htmlContent)) {
      toast.error("Version unavailable", {
        description: "This checkpoint cannot be restored from the current undo stack.",
      })
      return false
    }

    const normalizedHtml = version.htmlContent.trim()
    const normalizedVersionId = coerceVersionId(version.id)

    setHtmlContent(normalizedHtml)
    htmlContentRef.current = normalizedHtml
    lastAppliedHtml.current = normalizedHtml
    requestStableHtmlRef.current = normalizedHtml
    setCurrentVersionId(normalizedVersionId)
    setCodeVersionHash(fastHash(normalizedHtml))
    setHasUnsavedChanges(lastSavedContentRef.current !== normalizedHtml)
    setPreviewHtmlContent(null)
    setViewMode("preview")
    return true
  }, [toast])

  const stableVersions = versions.filter((version) => canUseStableProjectHtml(version.htmlContent))
  const currentStableVersionIndex = stableVersions.findIndex(
    (version) => coerceVersionId(version.id) === currentVersionId,
  )
  const canUndoVersionNavigation = currentStableVersionIndex > 0
  const canRedoVersionNavigation =
    currentStableVersionIndex >= 0 && currentStableVersionIndex < stableVersions.length - 1

  const handlePreviewVersion = useCallback((version: HistoryVersion | null) => {
    if (!version) {
      setPreviewHtmlContent(null)
      return true
    }

    if (!canUseStableProjectHtml(version.htmlContent)) {
      toast.error("Version preview unavailable", {
        description: "This checkpoint only captured a temporary loading state and cannot be previewed.",
      })
      setPreviewHtmlContent(null)
      return false
    }

    setPreviewHtmlContent(version.htmlContent)
    setViewMode("preview")
    return true
  }, [toast])

  const handleRestoreVersion = useCallback(async (version: HistoryVersion) => {
    if (!version || !version.htmlContent) {
      toast.error("Restore failed", {
        description: "Selected version could not be restored.",
      })
      return false
    }

    const targetVersionId = coerceVersionId(version.id)
    const didApply = applyVersionSnapshot(version)
    if (!didApply) {
      return false
    }

    setHasUnsavedChanges(true)

    toast.success("Version restored", {
      description: version.description || "Reverted to selected checkpoint.",
    })

    await createCheckpoint("Restored checkpoint", {
      silent: true,
      kind: "restore",
      trigger: "restore",
      restoredFromId: MONGO_OBJECT_ID_REGEX.test(targetVersionId) ? targetVersionId : undefined,
    })
    return true
  }, [applyVersionSnapshot, createCheckpoint, toast])

  const handleElementSelect = useCallback((info: SelectedElementInfo) => {
    if (!info.selector.trim()) {
      return
    }

    startTransition(() => {
      setSelectedElement({
        id: info.selector,
        type: info.type,
        styles: info.styles,
        properties: info.properties,
        clickPosition: info.clickPosition
      })
      setPanelPosition(info.clickPosition)
    })
  }, [])

  const handleTextEditStart = useCallback(() => {
    startTransition(() => {
      setSelectedElement(null)
      setPanelPosition(null)
    })
  }, [])

  // Calculate panel position to keep it within viewport
  const calculatePanelPosition = useCallback((clickPos: { x: number; y: number }) => {
    const panelWidth = 288 + 16 // w-72 + padding
    const panelHeight = 480 + 16 // max-h-[480px] + padding
    const offset = 12
    const sidebarWidth = sidebarOpen ? 380 : 0
    
    // Get available viewport area (accounting for sidebar)
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    let left = clickPos.x + offset
    let top = clickPos.y
    
    // Check right edge - if panel would overflow, position to left of cursor
    if (left + panelWidth > viewportWidth) {
      left = Math.max(sidebarWidth + 8, clickPos.x - panelWidth - offset)
    }
    
    // Ensure left doesn't go behind sidebar
    left = Math.max(sidebarWidth + 8, left)
    
    // Check bottom edge - if panel would overflow, position above cursor
    if (top + panelHeight > viewportHeight) {
      top = Math.max(60, viewportHeight - panelHeight - 8) // 60 for top nav
    }
    
    // Ensure top doesn't go above viewport (accounting for top nav)
    top = Math.max(60, top)
    
    return { left, top }
  }, [sidebarOpen])

  const handleClosePanel = useCallback(() => {
    setSelectedElement(null)
    setPanelPosition(null)
  }, [])

  const handleLiveStyleChange = useCallback((property: string, value: StyleProperty) => {
    if (!selectedElement) return

    // Direct DOM update
    applyChangeToIframe(selectedElement.id, property, value)
    syncSelectedElementFromIframe(selectedElement.id, selectedElement.clickPosition)
  }, [applyChangeToIframe, selectedElement, syncSelectedElementFromIframe])

  // Apply style to DOM and update HTML
  const applyStyleToDOM = useCallback((
    selector: string, 
    property: string, 
    value: StyleProperty,
    recordHistory: boolean = true
  ) => {
    try {
      const baseHtml = lastAppliedHtml.current || htmlContentRef.current || htmlContent
      const parser = new DOMParser()
      const doc = parser.parseFromString(baseHtml, "text/html")
      const normalizedSelector = selector.trim()
      const element = selectElementSafely(doc, normalizedSelector)
      
      if (element) {
        const htmlElement = element as HTMLElement
        const oldValue = htmlElement.style[property as any] || ''
        
        // Apply the style
        htmlElement.style[property as any] = value.toString()
        
        const newHtml = doc.documentElement.outerHTML
        commitHtmlContentUpdate(newHtml, { styleUpdate: true })
        
        // Record in history if needed
        if (recordHistory) {
          const styleChange: StyleChange = {
            id: createEditorEntityId("style"),
            selector: normalizedSelector,
            property,
            oldValue,
            newValue: value,
            timestamp: Date.now(),
          }
          styleHistoryActions.pushChange(styleChange)
        }
        
        return true
      }
    } catch (e) {
      console.error("Failed to update style", e)
    }
    return false
  }, [commitHtmlContentUpdate, htmlContent, styleHistoryActions])

  const handleStyleChange = useCallback((property: string, value: StyleProperty, validated?: boolean) => {
    if (!selectedElement) return

    // Apply to DOM
    const didApply = applyStyleToDOM(selectedElement.id, property, value, validated === true)
    if (didApply) {
      syncSelectedElementFromIframe(selectedElement.id, selectedElement.clickPosition)
    }
  }, [selectedElement, applyStyleToDOM, syncSelectedElementFromIframe])

  const handleTextChange = useCallback((selector: string, text: string) => {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      return
    }

    try {
      const baseHtml = lastAppliedHtml.current || htmlContentRef.current || htmlContent
      const parser = new DOMParser()
      const doc = parser.parseFromString(baseHtml, "text/html")
      const element = selectElementSafely(doc, normalizedSelector)
      if (!element) return

      const oldText = element.textContent ?? ""
      if (oldText === text) return

      element.textContent = text

      const newHtml = doc.documentElement.outerHTML
      commitHtmlContentUpdate(newHtml, { styleUpdate: true })

      const textChange: StyleChange = {
        id: createEditorEntityId("style"),
        selector: normalizedSelector,
        property: TEXT_CONTENT_PROPERTY,
        oldValue: oldText,
        newValue: text,
        timestamp: Date.now(),
      }
      styleHistoryActions.pushChange(textChange)

      if (selectedElement?.id === normalizedSelector) {
        syncSelectedElementFromIframe(normalizedSelector, selectedElement.clickPosition)
      }
    } catch (e) {
      console.error("Failed to update text", e)
    }
  }, [commitHtmlContentUpdate, htmlContent, selectedElement, styleHistoryActions, syncSelectedElementFromIframe])

  // Undo handler
  const handleUndo = useCallback(() => {
    const undoneChanges = styleHistoryActions.undo()
    if (!undoneChanges || undoneChanges.length === 0) {
      if (canUndoVersionNavigation) {
        const targetVersion = stableVersions[currentStableVersionIndex - 1]
        if (targetVersion && applyVersionSnapshot(targetVersion)) {
          toast.success("Reverted version", {
            description: targetVersion.description || "Moved to the previous checkpoint.",
          })
        }
      }
      return
    }
    
    // Apply the old values
    try {
      const baseHtml = htmlContentRef.current || htmlContent
      const parser = new DOMParser()
      const doc = parser.parseFromString(baseHtml, "text/html")
      
      for (const change of undoneChanges) {
        const element = selectElementSafely(doc, change.selector)
        if (element) {
          if (change.property === TEXT_CONTENT_PROPERTY) {
            element.textContent = change.oldValue?.toString() ?? ""
          } else {
            (element as HTMLElement).style[change.property as any] = change.oldValue.toString()
          }
        }
      }
      
      const newHtml = doc.documentElement.outerHTML
      commitHtmlContentUpdate(newHtml, { styleUpdate: true })

      // Apply to iframe for immediate UI update
      for (const change of undoneChanges) {
        const value = change.oldValue
        applyChangeToIframe(change.selector, change.property, value)
      }
      
      if (selectedElement) {
        syncSelectedElementFromIframe(selectedElement.id, selectedElement.clickPosition)
      }
    } catch (e) {
      console.error("Failed to undo", e)
    }
  }, [applyChangeToIframe, applyVersionSnapshot, canUndoVersionNavigation, commitHtmlContentUpdate, currentStableVersionIndex, htmlContent, selectedElement, stableVersions, styleHistoryActions, syncSelectedElementFromIframe, toast])

  // Redo handler
  const handleRedo = useCallback(() => {
    const redoneChanges = styleHistoryActions.redo()
    if (!redoneChanges || redoneChanges.length === 0) {
      if (canRedoVersionNavigation) {
        const targetVersion = stableVersions[currentStableVersionIndex + 1]
        if (targetVersion && applyVersionSnapshot(targetVersion)) {
          toast.success("Reapplied version", {
            description: targetVersion.description || "Moved to the next checkpoint.",
          })
        }
      }
      return
    }
    
    // Apply the new values
    try {
      const baseHtml = htmlContentRef.current || htmlContent
      const parser = new DOMParser()
      const doc = parser.parseFromString(baseHtml, "text/html")
      
      for (const change of redoneChanges) {
        const element = selectElementSafely(doc, change.selector)
        if (element) {
          if (change.property === TEXT_CONTENT_PROPERTY) {
            element.textContent = change.newValue?.toString() ?? ""
          } else {
            (element as HTMLElement).style[change.property as any] = change.newValue.toString()
          }
        }
      }
      
      const newHtml = doc.documentElement.outerHTML
      commitHtmlContentUpdate(newHtml, { styleUpdate: true })

      // Apply to iframe for immediate UI update
      for (const change of redoneChanges) {
        const value = change.newValue
        applyChangeToIframe(change.selector, change.property, value)
      }
      
      if (selectedElement) {
        syncSelectedElementFromIframe(selectedElement.id, selectedElement.clickPosition)
      }
    } catch (e) {
      console.error("Failed to redo", e)
    }
  }, [applyChangeToIframe, applyVersionSnapshot, canRedoVersionNavigation, commitHtmlContentUpdate, currentStableVersionIndex, htmlContent, selectedElement, stableVersions, styleHistoryActions, syncSelectedElementFromIframe, toast])

  const handleElementChange = useCallback((element: SelectedElement) => {
    if (!selectedElement) return

    try {
      const parser = new DOMParser()
      const baseHtml = lastAppliedHtml.current || htmlContentRef.current || htmlContent
      const doc = parser.parseFromString(baseHtml, "text/html")
      const domElement = selectElementSafely(doc, selectedElement.id)
      const liveElement = previewRef.current?.contentDocument
        ? selectElementSafely(previewRef.current.contentDocument, selectedElement.id)
        : null
      
      if (domElement) {
        applyElementProperties(domElement, element.properties)
        if (liveElement) {
          applyElementProperties(liveElement, element.properties)
        }

        commitHtmlContentUpdate(doc.documentElement.outerHTML)

        if (liveElement) {
          syncSelectedElementFromIframe(liveElement, selectedElement.clickPosition)
        } else {
          setSelectedElement(element)
        }
      }
    } catch (e) {
      console.error("Failed to update element properties", e)
    }
  }, [applyElementProperties, commitHtmlContentUpdate, htmlContent, selectedElement, syncSelectedElementFromIframe])

  // Render content based on view mode
  const renderContent = () => {
    const liveDraftHtml = getRenderableStreamingHtml(draftAiOutput)

    switch (viewMode) {
      case "preview":
      case "design":
        const panelPos = panelPosition ? calculatePanelPosition(panelPosition) : null
        const isDesignCanvasMode = viewMode === "design"
        const livePreviewHtml = previewHtmlContent ??
          // ponytail: during follow-up generation, use the last committed
          // stable HTML, never the streaming draft. Prevents blank/broken
          // intermediate states (Bug #3). Initial generation still streams.
          (isGenerating && activeAiRequestRef.current.isFollowUp
            ? stablePreviewHtmlRef.current
            : isGenerating
              ? liveDraftHtml
              : null) ??
          htmlContent
        return (
          <div className="flex h-full min-h-0 relative overflow-hidden">
            <PreviewFrame
              htmlContent={isDesignCanvasMode ? htmlContent : livePreviewHtml}
              deviceMode={deviceMode}
              className="flex-1"
              isDesignMode={isDesignCanvasMode}
              onElementSelect={isDesignCanvasMode ? handleElementSelect : undefined}
              onTextChange={isDesignCanvasMode ? handleTextChange : undefined}
              onTextEditStart={isDesignCanvasMode ? handleTextEditStart : undefined}
              forwardedRef={previewRef}
              previewUpdateToken={previewUpdateSignal.token}
              previewUpdateMode={previewUpdateSignal.mode}
              codeVersionHash={codeVersionHash}
            />
            {isDesignCanvasMode && selectedElement && panelPos && (
              <div 
                className="fixed z-50"
                style={{
                  left: panelPos.left,
                  top: panelPos.top,
                }}
              >
                <StylePanel
                  selectedElement={selectedElement}
                  onStyleChange={handleStyleChange}
                  onLiveStyleChange={handleLiveStyleChange}
                  onElementChange={handleElementChange}
                  onClose={handleClosePanel}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={styleHistoryActions.canUndo}
                  canRedo={styleHistoryActions.canRedo}
                />
              </div>
            )}
          </div>
        )
      case "code":
        const liveEditorValue = liveDraftHtml || draftAiOutput || htmlContent

        return (
          <CodeEditor
            value={isGenerating ? liveEditorValue : htmlContent}
            onChange={handleCodeChange}
            readOnly={isGenerating}
            className="h-full"
            modelPath={`/project/${projectId || "new"}/index.html`}
          />
        )
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-full sm:w-[380px] sm:py-3 sm:pl-3",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full w-full flex-col bg-[#0a0a0a] sm:border border-zinc-800/80 sm:rounded-[20px] overflow-hidden sm:shadow-2xl">
          {/* Sidebar Header */}
        <div className="h-8 px-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="group p-0.5 rounded-md flex items-center justify-center relative"
              onClick={() => {
                if (onBack) {
                  onBack()
                } else {
                  router.push("/dashboard")
                }
              }}
            >
              <img
                src="/Codeui.svg"
                alt="CodeUI"
                className="h-5 w-auto group-hover:opacity-0 transition-opacity"
              />
              <ChevronLeft className="absolute w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="bg-transparent text-xs font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white/[0.08] rounded px-1 -ml-1"
              />
              {hasUnsavedChanges && (
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" title="Unsaved changes" />
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] rounded-md transition-colors"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetChat}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] rounded-md transition-colors"
              title="Reset Chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-3 py-3 min-h-0 min-w-0">
          {messages.length === 0 && !pendingDesignDiscovery ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-3">
              <div className="mb-1.5 flex items-center justify-center">
                <SolarCodeSquareLinear className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-1">
                Start Building
              </h3>
              <p className="text-[11px] text-zinc-500 mb-3 max-w-[240px]">
                Describe the website you want to create. Be as detailed as you like!
              </p>
              <div className="space-y-1.5 w-full">
                {EXAMPLE_PROMPTS.slice(0, 3).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt)}
                    className="w-full text-left text-[11px] text-zinc-400 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.04] rounded-md px-2.5 py-1.5 transition-colors"
                  >
                    {prompt.slice(0, 60)}...
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const thinkingPanelId = `thinking-panel-${message.id}`
                const isStreamingThinking = message.role === "assistant" && message.isThinking

                return (
                <div key={message.id} className="space-y-1.5">
                  <div
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg px-3 py-1.5 max-w-[90%]",
                        message.role === "user"
                          ? "bg-[#27272A] text-zinc-100"
                          : "bg-transparent text-zinc-100"
                      )}
                    >
                      {message.role === "assistant" && message.isThinking && !message.content ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-1.5">
                            <TextShimmer className="font-mono text-xs" duration={1}>
                              {message.progressLabel || "Generating code..."}
                            </TextShimmer>
                            <button
                              onClick={cancelAI}
                              aria-label="Cancel generation"
                              className="p-0.5 rounded-md hover:bg-zinc-800 text-zinc-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : message.role === "user" && message.content.length > LONG_USER_MSG_THRESHOLD ? (
                        <div className="space-y-1.5">
                          {/* Image thumbnails */}
                          {message.images && message.images.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {message.images.map((dataUrl, i) => (
                                <img
                                  key={i}
                                  src={dataUrl}
                                  alt={`Attached image ${i + 1}`}
                                  className="max-h-20 rounded-md border border-white/[0.06] object-cover"
                                />
                              ))}
                            </div>
                          ) : null}
                          <MarkdownRenderer
                            content={message.content}
                            className={cn(
                              "text-xs",
                              !expandedUserMessages.has(message.id) && "line-clamp-3"
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => toggleUserMessage(message.id)}
                            className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
                          >
                            {expandedUserMessages.has(message.id) ? (
                              <><ChevronUp className="w-3 h-3" /> Show less</>
                            ) : (
                              <><ChevronDown className="w-3 h-3" /> Show more</>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {/* Image thumbnails */}
                          {message.images && message.images.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {message.images.map((dataUrl, i) => (
                                <img
                                  key={i}
                                  src={dataUrl}
                                  alt={`Attached image ${i + 1}`}
                                  className="max-h-20 rounded-md border border-white/[0.06] object-cover"
                                />
                              ))}
                            </div>
                          ) : null}
                          <MarkdownRenderer content={message.content} className="text-xs" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Thinking panel for assistant */}
                  {message.role === "assistant" && message.thinkingContent && (() => {
                    const sanitized = sanitizeThinkingForDisplay(message.thinkingContent)
                    if (!sanitized.trim()) return null
                    const isExpanded = isStreamingThinking || expandedThinkingIds.has(message.id)
                    return (
                    <div className="ml-2">
                      <div
                        className={cn(
                          "max-w-[85%] text-left transition-all",
                          isExpanded
                            ? "flex max-h-[160px] w-full flex-col overflow-hidden rounded-lg bg-zinc-900/50 pl-3"
                            : "w-fit"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleThinking(message.id)}
                          aria-expanded={isExpanded}
                          aria-controls={thinkingPanelId}
                          className={cn(
                            "flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300",
                            isExpanded ? "pt-2 pb-1.5" : ""
                          )}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-2.5 h-2.5" />
                          ) : (
                            <ChevronDown className="w-2.5 h-2.5" />
                          )}
                          Thinking
                        </button>
                        {isExpanded ? (
                          <div
                            id={thinkingPanelId}
                            ref={isStreamingThinking ? activeThinkingScrollRef : undefined}
                            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2.5 pr-1 text-xs leading-5 text-zinc-500 thinking-markdown"
                          >
                            <MarkdownRenderer content={sanitized} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    )
                  })()}
                </div>
              )})}

              {pendingDesignDiscovery ? (
                <div className="flex justify-start">
                  <DesignDiscoveryBlock
                    reasoning={pendingDesignDiscovery.reasoning}
                    question={pendingDesignDiscovery.questions[pendingDesignDiscovery.currentQuestionIndex]}
                    answer={pendingDesignDiscovery.questions[pendingDesignDiscovery.currentQuestionIndex]
                      ? pendingDesignDiscovery.answers[pendingDesignDiscovery.questions[pendingDesignDiscovery.currentQuestionIndex].id]
                      : undefined}
                    currentQuestionIndex={pendingDesignDiscovery.currentQuestionIndex}
                    totalQuestions={pendingDesignDiscovery.questions.length}
                    isLoading={pendingDesignDiscovery.isLoading}
                    isSubmitting={pendingDesignDiscovery.isSubmitting}
                    onSelectOption={handleDesignDiscoveryOptionSelect}
                    onCustomAnswerChange={handleDesignDiscoveryCustomAnswerChange}
                    onCustomAnswerSubmit={handleDesignDiscoveryNext}
                    onPrevious={handleDesignDiscoveryPrevious}
                    onNext={handleDesignDiscoveryNext}
                    onSkip={handleDesignDiscoverySkip}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-3 border-t border-zinc-800">
          <AI_Prompt 
            onSend={handleSend}
            onEnhance={handleEnhancePrompt}
            onDraftChange={handleComposerDraftChange}
            onCancel={cancelAI}
            initialModelId={state.selectedModel}
            onModelChange={setModel}
            availableModels={state.availableModels}
            isLoadingModels={state.isLoadingModels}
            isGenerating={isGenerating}
            queuedPrompt={queuedPrompt}
            onCancelQueued={cancelQueuedPrompt}
          />
        </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarOpen ? "lg:ml-[380px]" : ""
        )}
      >
        <TopNav
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          deviceMode={deviceMode}
          onDeviceModeChange={setDeviceMode}
          onExport={handleExport}
          onSave={handleSaveCheckpoint}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={styleHistoryActions.canUndo || canUndoVersionNavigation}
          canRedo={styleHistoryActions.canRedo || canRedoVersionNavigation}
          onHistoryOpen={() => setVersionHistoryOpen(true)}
          isGenerating={isGenerating}
          hasUnsavedChanges={hasUnsavedChanges}
          primaryColor={state.primaryColor}
          secondaryColor={state.secondaryColor}
          theme={state.theme}
          onPrimaryColorChange={setPrimaryColor}
          onSecondaryColorChange={setSecondaryColor}
          onThemeChange={setTheme}
        />

        <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
            <DialogHeader>
              <DialogTitle>Export project</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Choose a format for your download, or generate a prompt to recreate this UI.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <button
                onClick={() => setExportFormat("html")}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  exportFormat === "html"
                    ? "border-white/[0.10] bg-white/[0.04]"
                    : "border-white/[0.04] bg-transparent hover:bg-white/[0.03]"
                )}
              >
                <p className="text-sm font-medium text-zinc-100">HTML</p>
                <p className="text-xs text-zinc-400 mt-1">Downloads the complete current HTML document.</p>
              </button>

              <button
                onClick={() => setExportFormat("react")}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  exportFormat === "react"
                    ? "border-white/[0.10] bg-white/[0.04]"
                    : "border-white/[0.04] bg-transparent hover:bg-white/[0.03]"
                )}
              >
                <p className="text-sm font-medium text-zinc-100">React (.tsx)</p>
                <p className="text-xs text-zinc-400 mt-1">Best-effort JSX conversion from your current HTML and styles.</p>
              </button>

              <button
                onClick={() => setExportFormat("prompt")}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  exportFormat === "prompt"
                    ? "border-white/[0.10] bg-white/[0.04]"
                    : "border-white/[0.04] bg-transparent hover:bg-white/[0.03]"
                )}
              >
                <p className="text-sm font-medium text-zinc-100">Generate Prompt</p>
                <p className="text-xs text-zinc-400 mt-1">Creates a detailed prompt to recreate this UI in any AI agent.</p>
              </button>
            </div>

            <DialogFooter>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="h-9 px-3 rounded-md border border-white/[0.06] text-zinc-400 hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExport}
                className="h-9 px-3 rounded-md bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-colors"
              >
                {exportFormat === "prompt" ? "Copy Prompt" : exportFormat === "react" ? "Export TSX" : "Export HTML"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <VersionHistory
          versions={versions}
          currentVersionId={currentVersionId}
          onRestore={handleRestoreVersion}
          onPreview={handlePreviewVersion}
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
          trigger={null}
        />

        {/* Canvas/Editor Area */}
        <div className="flex-1 min-h-0 overflow-hidden bg-white/[0.02]">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
