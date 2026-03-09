export interface PromptScopeValidation {
  valid: boolean
  requiredRequirements: string[]
  missingRequirements: string[]
}

interface ScopeRequirement {
  label: string
  patterns: RegExp[]
  matchMode?: "all" | "any"
}

interface PromptFeatureRule {
  promptPatterns: RegExp[]
  requirement: ScopeRequirement
}

const FEATURE_RULES: PromptFeatureRule[] = [
  {
    promptPatterns: [/dark theme/i, /dark mode/i],
    requirement: {
      label: "dark visual treatment",
      patterns: [/bg-(black|zinc|slate|neutral|stone-9)/i, /#0[0-9a-f]{2}|#111|#000/i, /text-white|text-zinc-100|text-slate-100/i, /color-scheme:\s*dark/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/light theme/i, /light mode/i],
    requirement: {
      label: "light visual treatment",
      patterns: [/bg-white|bg-zinc-50|bg-stone-50|bg-slate-50/i, /#f[0-9a-f]{2}|#fff/i, /text-slate-900|text-zinc-900|text-black/i, /color-scheme:\s*light/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/gallery/i, /image gallery/i, /photo gallery/i],
    requirement: {
      label: "gallery presentation",
      patterns: [/(gallery|selected work|featured work|portfolio)/i, /<img|background-image|object-cover/i],
      matchMode: "all",
    },
  },
  {
    promptPatterns: [/pricing/i, /pricing cards/i, /plans/i],
    requirement: {
      label: "pricing section",
      patterns: [/(pricing|plan|starter|pro|enterprise)/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/(e-?commerce|online store|storefront|shop ui|shopping app|marketplace)/i],
    requirement: {
      label: "product merchandising",
      patterns: [/(product|collection|featured product|shop|catalog)/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/(e-?commerce|online store|storefront|shop ui|shopping app|marketplace)/i],
    requirement: {
      label: "pricing visibility",
      patterns: [/(\$|usd|price|sale|discount)/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/(e-?commerce|online store|storefront|shop ui|shopping app|marketplace)/i],
    requirement: {
      label: "purchase actions",
      patterns: [/(add to cart|buy now|cart|checkout|shop now)/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/(e-?commerce|online store|storefront|shop ui|shopping app|marketplace)/i],
    requirement: {
      label: "product discovery navigation",
      patterns: [/(category|categories|filter|sort|collection|shop by)/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/testimonial/i, /review/i, /client/i],
    requirement: {
      label: "testimonials",
      patterns: [/(testimonial|review|client|what people say)/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/contact/i, /contact form/i, /get in touch/i],
    requirement: {
      label: "contact section",
      patterns: [/(contact|get in touch|message|email)/i, /<form|<input|<textarea/i],
      matchMode: "all",
    },
  },
  {
    promptPatterns: [/reservation/i, /book(ing)? form/i, /reserve/i],
    requirement: {
      label: "reservation flow",
      patterns: [/(reservation|reserve|book a table|book now)/i, /date|time|guests|party size/i],
      matchMode: "all",
    },
  },
  {
    promptPatterns: [/dashboard/i],
    requirement: {
      label: "dashboard navigation and data surface",
      patterns: [/(dashboard|overview|analytics|stats)/i, /(sidebar|menu|navigation)/i],
      matchMode: "all",
    },
  },
  {
    promptPatterns: [/spotify/i],
    requirement: {
      label: "sidebar navigation",
      patterns: [/(home|search|library|playlist)/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/spotify/i],
    requirement: {
      label: "music browsing rails",
      patterns: [/(recently played|popular|discover|trending|made for|albums|artists)/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/spotify/i],
    requirement: {
      label: "track or playlist listing",
      patterns: [/(track|song|artist|album|playlist|duration)/i],
      matchMode: "any",
    },
  },
  {
    promptPatterns: [/spotify/i],
    requirement: {
      label: "player controls",
      patterns: [/(play|pause)/i, /(next|previous|skip)/i, /(volume|progress|shuffle|repeat)/i],
      matchMode: "all",
    },
  },
  {
    promptPatterns: [/spotify/i],
    requirement: {
      label: "now playing area",
      patterns: [/(now playing|currently playing|queue|playing next)/i],
      matchMode: "any",
    },
  },
]

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().replace(/\s+/g, " ").trim()
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildPromptScopeRequirements(prompt: string): ScopeRequirement[] {
  const normalizedPrompt = normalizePrompt(prompt)
  const requirements: ScopeRequirement[] = []
  const seen = new Set<string>()

  for (const rule of FEATURE_RULES) {
    if (!rule.promptPatterns.some((pattern) => pattern.test(normalizedPrompt))) {
      continue
    }

    const key = rule.requirement.label.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    requirements.push(rule.requirement)
  }

  return requirements
}

export function validatePromptScope(prompt: string, html: string): PromptScopeValidation {
  const requirements = buildPromptScopeRequirements(prompt)
  if (requirements.length === 0) {
    return {
      valid: true,
      requiredRequirements: [],
      missingRequirements: [],
    }
  }

  const searchableHtml = `${html.toLowerCase()} ${stripHtml(html).toLowerCase()}`
  const missingRequirements = requirements
    .filter((requirement) => {
      if (requirement.matchMode === "any") {
        return !requirement.patterns.some((pattern) => pattern.test(searchableHtml))
      }

      return !requirement.patterns.every((pattern) => pattern.test(searchableHtml))
    })
    .map((requirement) => requirement.label)

  return {
    valid: missingRequirements.length === 0,
    requiredRequirements: requirements.map((requirement) => requirement.label),
    missingRequirements,
  }
}