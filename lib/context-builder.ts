import { getModelById } from './ai-models'
import { estimateTokenCount } from './token-counter'

export interface ContextInput {
  currentFile: {
    name: string
    content: string
  }
  otherFiles?: {
    name: string
    content: string
  }[]
  selectedElement?: string // HTML string of the selected element
  maxTokens?: number
  modelId?: string
  modelContextWindow?: number
  reservedOutputTokens?: number
}

const DEFAULT_MAX_TOKENS = 12000
const MODEL_CONTEXT_BUDGET_RATIO = 0.4
const SELECTED_ELEMENT_CONTEXT_RADIUS = 600

interface TruncateResult {
  content: string
  truncated: boolean
}

const resolveTokenBudget = ({ maxTokens, modelId, modelContextWindow, reservedOutputTokens }: ContextInput): number => {
  if (typeof maxTokens === 'number' && maxTokens > 0) {
    return maxTokens
  }

  const contextWindow =
    modelContextWindow ??
    (modelId ? getModelById(modelId)?.contextLength : undefined)

  if (!contextWindow) {
    return DEFAULT_MAX_TOKENS
  }

  const ratioBudget = Math.max(4000, Math.floor(contextWindow * MODEL_CONTEXT_BUDGET_RATIO))
  const reservedBudget = Math.max(0, reservedOutputTokens ?? 0)
  const availableBudget = Math.max(4000, contextWindow - reservedBudget)

  return Math.max(4000, Math.min(ratioBudget, availableBudget))
}

const buildTruncatedCurrentFile = (
  content: string,
  availableTokens: number,
  selectedElement?: string,
): TruncateResult => {
  if (availableTokens <= 0) {
    return {
      content: '<!-- Current file omitted: context budget exhausted -->',
      truncated: true,
    }
  }

  const approxCharBudget = Math.max(availableTokens * 4, 400)
  if (content.length <= approxCharBudget) {
    return { content, truncated: false }
  }

  const focusIndex = selectedElement ? content.indexOf(selectedElement) : -1
  const marker = '\n<!-- ... truncated for token budget ... -->\n'

  if (focusIndex >= 0) {
    const headBudget = Math.floor(approxCharBudget * 0.25)
    const focusBudget = Math.floor(approxCharBudget * 0.45)
    const tailBudget = Math.max(approxCharBudget - headBudget - focusBudget, 120)

    const focusStart = Math.max(0, focusIndex - Math.floor(focusBudget / 2))
    const focusEnd = Math.min(content.length, focusStart + focusBudget)

    const head = content.slice(0, headBudget)
    const focus = content.slice(focusStart, focusEnd)
    const tail = content.slice(Math.max(focusEnd, content.length - tailBudget))

    return {
      content: `${head}${marker}${focus}${marker}${tail}`,
      truncated: true,
    }
  }

  const headBudget = Math.floor(approxCharBudget * 0.55)
  const tailBudget = Math.max(approxCharBudget - headBudget, 120)

  return {
    content: `${content.slice(0, headBudget)}${marker}${content.slice(-tailBudget)}`,
    truncated: true,
  }
}

const buildSelectedElementReferenceContext = (
  content: string,
  selectedElement: string,
): string | null => {
  const focusIndex = content.indexOf(selectedElement)
  if (focusIndex < 0) {
    return null
  }

  const start = Math.max(0, focusIndex - SELECTED_ELEMENT_CONTEXT_RADIUS)
  const end = Math.min(content.length, focusIndex + selectedElement.length + SELECTED_ELEMENT_CONTEXT_RADIUS)
  const prefix = start > 0 ? "<!-- ... surrounding context omitted before target ... -->\n" : ""
  const suffix = end < content.length ? "\n<!-- ... surrounding context omitted after target ... -->" : ""

  return `${prefix}${content.slice(start, end)}${suffix}`
}

export function buildContext(input: ContextInput): string {
  const { currentFile, otherFiles = [], selectedElement } = input
  const maxTokens = resolveTokenBudget(input)
  const selectedElementReference = selectedElement
    ? buildSelectedElementReferenceContext(currentFile.content, selectedElement)
    : null
  
  let context = ""
  let currentTokens = 0

  const preservationContext = `
Preserve existing design baseline unless explicitly requested otherwise:
- Keep current layout structure and hierarchy.
- Keep typography scale, spacing rhythm, and color palette.
- Keep existing component behavior and animations.
- Apply only minimal scoped edits for the request.
`
  context += preservationContext;
  currentTokens += estimateTokenCount(preservationContext)

  // Priority 3: Selected Element (Highest Priority for immediate context)
  // We prepend this or make it very visible.
  if (selectedElement) {
    const elementContext = `

Target element to modify first:
${selectedElement}
`
    context += elementContext;
    currentTokens += estimateTokenCount(elementContext)

    if (selectedElementReference) {
      const referenceContext = `

Local surrounding context for the target element:
${selectedElementReference}
`
      context += referenceContext
      currentTokens += estimateTokenCount(referenceContext)
    }
  }

  // Priority 1: Current File
  const availableFileTokens = Math.max(maxTokens - currentTokens, 0)
  const truncatedCurrentFile = buildTruncatedCurrentFile(
    currentFile.content,
    availableFileTokens,
    selectedElement,
  )

  const currentFileContext = selectedElement
    ? `
Reference file: ${currentFile.name}
The full file below is reference-only. Preserve the current page and change only the requested area.
${truncatedCurrentFile.content}
`
    : `
Current file: ${currentFile.name}
${truncatedCurrentFile.content}
`
  const currentFileTokens = estimateTokenCount(currentFileContext)
  context = currentFileContext + context
  currentTokens += currentFileTokens

  if (truncatedCurrentFile.truncated) {
    context += `\nContext note: The current file was truncated to stay within the model budget.\n`
    currentTokens += estimateTokenCount('Context note: The current file was truncated to stay within the model budget.')
  }

  // Priority 2: Other Files
  for (const file of otherFiles) {
    const fileHeader = `
File: ${file.name}
`
    const fileContent = file.content
    const fileTokens = estimateTokenCount(fileHeader + fileContent)

    if (currentTokens + fileTokens <= maxTokens) {
      context += `${fileHeader}${fileContent}
`
      currentTokens += fileTokens
    } else {
      break
    }
  }

  return context
}
