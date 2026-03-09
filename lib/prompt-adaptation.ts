interface AdaptationRule {
  patterns: RegExp[]
  lines: string[]
}

const ADAPTATION_RULES: AdaptationRule[] = [
  {
    patterns: [/(e-?commerce|online store|storefront|shop ui|shopping app|marketplace)/i],
    lines: [
      "Use current e-commerce UI conventions: clean merchandising hierarchy, intuitive category discovery, and prominent search, cart, and account actions.",
      "Product presentation should feel contemporary: polished product cards, pricing visibility, badges or ratings where appropriate, and visually strong product imagery.",
      "Support shopping flow clarity with collection navigation, filter or sort affordances, trust cues, and strong purchase calls to action.",
    ],
  },
  {
    patterns: [/(spotify|music app|streaming app|audio app|media player)/i],
    lines: [
      "Match modern media-platform patterns: immersive content rails, clear sidebar or library navigation, and an always-legible playback area.",
      "Include strong browsing and listening cues such as playlists, artists, albums, progress indicators, and tactile player controls.",
    ],
  },
  {
    patterns: [/(dashboard|admin|analytics|back office|control panel)/i],
    lines: [
      "Use modern dashboard structure: concise navigation, high-signal metrics, readable density, and clear separation between overview, filters, tables, and charts.",
      "Favor operational clarity over decoration while keeping the interface polished and contemporary.",
    ],
  },
  {
    patterns: [/(portfolio|photographer|creative studio|designer portfolio|agency portfolio)/i],
    lines: [
      "Use an editorial portfolio approach: strong visual storytelling, confident typography, and spacious layouts that elevate featured work.",
      "Prioritize image treatment, project hierarchy, and distinct section transitions over generic landing-page blocks.",
    ],
  },
  {
    patterns: [/(saas|startup|product landing|software platform)/i],
    lines: [
      "Use contemporary SaaS patterns: clear value hierarchy, polished feature blocks, proof elements, integration or workflow modules, and conversion-focused pricing or call-to-action areas.",
    ],
  },
  {
    patterns: [/(material design|material ui|android)/i],
    lines: [
      "Align the interface with Material Design principles: structured surfaces, clear elevation, rounded components, strong hierarchy, and motion that feels purposeful and tactile.",
      "Use navigation patterns and controls that feel native to Material-style products rather than generic marketing layouts.",
    ],
  },
  {
    patterns: [/(ios|apple|cupertino)/i],
    lines: [
      "Align the UI with contemporary Apple-style product design: refined spacing, restrained chrome, polished translucency where appropriate, and interface rhythm that feels precise and premium.",
    ],
  },
  {
    patterns: [/(modern|contemporary)/i],
    lines: [
      "Express the requested modern aesthetic through clean composition, crisp hierarchy, polished spacing, and interaction details that feel current rather than generic.",
    ],
  },
  {
    patterns: [/(luxury|premium|high-end)/i],
    lines: [
      "Use a premium visual language: restrained palette, elevated typography, deliberate spacing, and refined imagery or surfaces.",
    ],
  },
  {
    patterns: [/(minimal|minimalist)/i],
    lines: [
      "Keep the layout minimal without becoming empty: fewer but stronger elements, careful spacing, and precise typography-driven hierarchy.",
    ],
  },
]

export function getPromptAdaptationGuidance(prompt: string): string {
  const normalizedPrompt = prompt.trim()
  if (!normalizedPrompt) {
    return ""
  }

  const collectedLines: string[] = []
  const seen = new Set<string>()

  for (const rule of ADAPTATION_RULES) {
    if (!rule.patterns.some((pattern) => pattern.test(normalizedPrompt))) {
      continue
    }

    for (const line of rule.lines) {
      const key = line.toLowerCase()
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      collectedLines.push(line)
    }
  }

  if (collectedLines.length === 0) {
    return ""
  }

  return [
    "PROMPT-SPECIFIC ADAPTATION REQUIREMENTS:",
    ...collectedLines.map((line) => `- ${line}`),
  ].join("\n")
}