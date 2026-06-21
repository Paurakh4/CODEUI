/**
 * Lightweight intent classifier for reprompt requests.
 *
 * Classifies a follow-up prompt into one of:
 *   - `text`     — changing copy/headings/labels only
 *   - `color`    — changing theme/color palette
 *   - `layout`   — changing element arrangement (horizontal, vertical, grid)
 *   - `structural` — adding/removing components or sections
 *   - `restore`  — asking to bring back previously lost content
 *   - `vague`    — general improvement request with no specific target
 *   - `unknown`  — can't confidently classify
 *
 * `text` and `color` intents are candidates for surgical SEARCH/REPLACE mode
 * because they typically touch a small number of DOM nodes without altering
 * the document scaffold.
 */

export interface IntentResult {
  kind: "text" | "color" | "layout" | "structural" | "restore" | "vague" | "unknown"
  confidence: number // 0–1
  /** Words/phrases that triggered the classification. */
  triggers: string[]
}

interface IntentRule {
  kind: IntentResult["kind"]
  patterns: RegExp[]
  weight: number
}

const RULES: IntentRule[] = [
  // ── Text changes ──
  {
    kind: "text",
    patterns: [
      /\b(?:change|update|replace|edit|fix|correct|rewrite|modify)\s+(?:the\s+)?(?:heading|headline|title|text|copy|subtitle|tagline|label|description|paragraph|sentence|word|wording|name)\b/i,
      /\b(?:rename|reword|rephrase)\b/i,
      /\b(?:heading|headline|title|text|copy|subtitle|tagline|label|description)\s+(?:change|update|edit|fix)\b/i,
      /\bchange\s+(?:the\s+)?(?:text|copy|wording)\b/i,
      /\bonly\s+(?:the\s+)?(?:text|heading|title|copy)\b/i,
    ],
    weight: 8,
  },
  // ── Color/theme changes ──
  {
    kind: "color",
    patterns: [
      /\b(?:color|theme|palette|accent|scheme|dark|light)\b.*\b(?:change|update|switch|make|set|use|add|apply)\b/i,
      /\b(?:change|update|switch|make|set|use|add|apply)\b.*\b(?:color|theme|palette|accent|scheme|dark|light)\b/i,
      /\b(?:dark|light)\s+(?:mode|theme)\b/i,
      /\b(?:purple|blue|red|green|orange|pink|teal|indigo|violet|yellow|cyan|magenta|amber|lime|emerald|rose|fuchsia)\s+(?:accent|theme|color|palette)\b/i,
      /\b(?:#?[0-9a-fA-F]{3,6})\b/,
    ],
    weight: 7,
  },
  // ── Layout changes ──
  {
    kind: "layout",
    patterns: [
      /\b(?:make|change|set|arrange|put|switch|convert|turn|reorder|rearrange)\b.*\b(?:horizontal|vertical|side.by.side|stack|grid|row|column|layout|arrangement|flex|inline)\b/i,
      /\b(?:horizontal|vertical|side.by.side|stack|grid|row|column)\b.*\b(?:layout|arrangement|view|display|orientation)\b/i,
      /\b(?:wider|narrower|full.width|centered|aligned|spaced)\b/i,
      /\b(?:flex|grid|block|inline)\s+(?:layout|display)\b/i,
    ],
    weight: 7,
  },
  // ── Structural changes (add/remove components) ──
  {
    kind: "structural",
    patterns: [
      /\b(?:add|create|insert|include|put|build)\s+(?:a\s+|an\s+|the\s+)?(?:section|component|card|panel|block|module|widget|form|modal|navbar|footer|header|sidebar|faq|testimonial|pricing|hero|gallery|contact)\b/i,
      /\b(?:remove|delete|drop|hide|get\s+rid\s+of)\s+(?:the\s+)?(?:section|component|card|panel|block|module|widget|form|modal|navbar|footer|header|sidebar|faq|testimonial|pricing|hero|gallery|contact)\b/i,
      /\bneed(?:s|ed)?\s+(?:a\s+|an\s+|the\s+)?(?:section|component|card|panel|block|module|widget|form|modal|navbar|footer|header|sidebar|faq|testimonial|pricing|hero|gallery|contact)\b/i,
      /\b(?:section|component|card|panel|block|module|widget|form|modal|navbar|footer|header|sidebar|faq|testimonial|pricing|hero|gallery|contact)\s+(?:with|that\s+has|containing|showing)\b/i,
    ],
    weight: 6,
  },
  // ── Restore requests ──
  {
    kind: "restore",
    patterns: [
      /\b(?:restore|bring\s+back|put\s+back|recover|get\s+back)\s+(?:the\s+)?(?:plan|price|name|text|content|heading|list|bullet|feature)\b/i,
      /\b(?:restore|bring\s+back|put\s+back)\s+(?:what|that|those|the\s+ones?)\s+(?:was|were)\s+(?:there|before|previously|earlier)\b/i,
      /\bthat\s+(?:were|was)\s+(?:there|present)\s+before\b/i,
      /\bundo\s+(?:the\s+)?(?:last|previous)\s+(?:change|edit|update)\b/i,
    ],
    weight: 9,
  },
  // ── Vague prompts ──
  {
    kind: "vague",
    patterns: [
      /^make\s+it\s+(?:look\s+)?better\.?$/i,
      /^improve\s+(?:it|this|the\s+(?:design|page|ui|look))\.?$/i,
      /^(?:polish|refine|tweak|tighten\s+up)\s*(?:it|this)?\.?$/i,
      /^(?:fix\s+it|make\s+it\s+(?:nice|good|great|beautiful|pretty))\.?$/i,
      /^(?:enhance|upgrade)\s+(?:it|this|the\s+(?:design|page|ui|look))\.?$/i,
    ],
    weight: 5,
  },
]

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * Classify the intent of a follow-up reprompt.
 *
 * Returns `unknown` when no rule fires with confidence > 0, or when
 * multiple high-confidence rules of different kinds conflict.
 */
export function classifyRepromptIntent(prompt: string): IntentResult {
  const normalized = normalizePrompt(prompt)
  if (!normalized) {
    return { kind: "unknown", confidence: 0, triggers: [] }
  }

  const scores = new Map<IntentResult["kind"], { total: number; triggers: string[] }>()

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(normalized)
      if (match) {
        const entry = scores.get(rule.kind) ?? { total: 0, triggers: [] }
        entry.total += rule.weight
        entry.triggers.push(match[0])
        scores.set(rule.kind, entry)
      }
    }
  }

  if (scores.size === 0) {
    return { kind: "unknown", confidence: 0, triggers: [] }
  }

  // Find the highest-scoring kind.
  let bestKind: IntentResult["kind"] = "unknown"
  let bestScore = 0
  let bestTriggers: string[] = []

  for (const [kind, entry] of scores) {
    if (entry.total > bestScore) {
      bestKind = kind
      bestScore = entry.total
      bestTriggers = entry.triggers
    }
  }

  // Confidence: normalize score to 0–1 range (max observed ~40 for strong matches).
  const confidence = Math.min(1, bestScore / 16)

  // If another kind is within 3 points, it's ambiguous — downgrade.
  for (const [kind, entry] of scores) {
    if (kind !== bestKind && entry.total >= bestScore - 3 && entry.total > 0) {
      return { kind: "unknown", confidence: 0.3, triggers: bestTriggers }
    }
  }

  return { kind: bestKind, confidence, triggers: bestTriggers }
}
