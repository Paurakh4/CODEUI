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
}

const DEFAULT_MAX_TOKENS = 12000
const MODEL_CONTEXT_BUDGET_RATIO = 0.4

interface TruncateResult {
  content: string
  truncated: boolean
}

const resolveTokenBudget = ({ maxTokens, modelId, modelContextWindow }: ContextInput): number => {
  if (typeof maxTokens === 'number' && maxTokens > 0) {
    return maxTokens
  }

  const contextWindow =
    modelContextWindow ??
    (modelId ? getModelById(modelId)?.contextLength : undefined)

  if (!contextWindow) {
    return DEFAULT_MAX_TOKENS
  }

  return Math.max(4000, Math.floor(contextWindow * MODEL_CONTEXT_BUDGET_RATIO))
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

export function buildContext(input: ContextInput): string {
  const { currentFile, otherFiles = [], selectedElement } = input
  const maxTokens = resolveTokenBudget(input)
  
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

Update ONLY this element:
${selectedElement}
`
    context += elementContext;
    currentTokens += estimateTokenCount(elementContext)
  }

  // Priority 1: Current File
  const availableFileTokens = Math.max(maxTokens - currentTokens, 0)
  const truncatedCurrentFile = buildTruncatedCurrentFile(
    currentFile.content,
    availableFileTokens,
    selectedElement,
  )

  const currentFileContext = `
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
