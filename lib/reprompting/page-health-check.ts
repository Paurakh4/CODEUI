/**
 * Page health check — detects critical empty nodes and missing content
 * before executing a vague or general reprompt.
 *
 * When the user says "make it look better" on a page with blank pricing cards,
 * the model should be told about the broken state so it can fix it.
 */

export interface PageHealthIssue {
  /** Human-readable description of the issue. */
  description: string
  /** CSS selector or tag pattern of the affected node. */
  selector: string
  /** Severity: "critical" means the page is visibly broken. */
  severity: "critical" | "warning"
}

/**
 * Assess the health of an HTML page.
 * Returns a list of critical empty nodes and missing content.
 */
export function assessPageHealth(html: string): PageHealthIssue[] {
  const issues: PageHealthIssue[] = []

  // Detect empty card/section containers — common structural elements
  // that should have content but may have been wiped.
  const containerPatterns = [
    { regex: /<div[^>]*class="[^"]*\b(?:card|pricing-card|plan-card|feature-card|testimonial-card)[^"]*"[^>]*>\s*<\/div>/gi, label: "empty card", severity: "critical" as const },
    { regex: /<section[^>]*>\s*<\/section>/gi, label: "empty section", severity: "critical" as const },
    { regex: /<ul[^>]*>\s*<\/ul>/gi, label: "empty list", severity: "warning" as const },
    { regex: /<ol[^>]*>\s*<\/ol>/gi, label: "empty ordered list", severity: "warning" as const },
    { regex: /<h[1-6][^>]*>\s*<\/h[1-6]>/gi, label: "empty heading", severity: "critical" as const },
    { regex: /<p[^>]*>\s*<\/p>/gi, label: "empty paragraph", severity: "warning" as const },
  ]

  for (const { regex, label, severity } of containerPatterns) {
    let count = 0
    // Reset lastIndex for each pattern.
    regex.lastIndex = 0
    while (regex.exec(html) !== null) {
      count++
    }
    if (count > 0) {
      issues.push({
        description: `Found ${count} ${label}${count > 1 ? "s" : ""}`,
        selector: label.replace(/\s+/g, "-"),
        severity,
      })
    }
  }

  // Detect pricing/plan containers with no visible text content.
  const pricingSectionMatch = html.match(
    /<div[^>]*class="[^"]*\b(?:pricing|plans?|tiers?)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*\b(?:pricing|plans?|tiers?)[^"]*"|$)/i,
  )
  if (pricingSectionMatch) {
    const sectionContent = pricingSectionMatch[1] || ""
    const textContent = sectionContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    if (textContent.length < 10) {
      issues.push({
        description: "Pricing section has little or no visible text content — plan names and prices may be missing",
        selector: "pricing-section",
        severity: "critical",
      })
    }
  }

  return issues
}

/**
 * Build a page health warning block to prepend to the user message.
 */
export function buildPageHealthWarning(issues: PageHealthIssue[]): string {
  if (issues.length === 0) return ""

  const critical = issues.filter((i) => i.severity === "critical")
  const warnings = issues.filter((i) => i.severity === "warning")

  const lines: string[] = []
  if (critical.length > 0) {
    lines.push("PAGE HEALTH WARNING — the following critical issues were detected on the current page:")
    for (const issue of critical) {
      lines.push(`- [CRITICAL] ${issue.description}`)
    }
  }
  if (warnings.length > 0) {
    lines.push("Additional warnings:")
    for (const issue of warnings) {
      lines.push(`- [WARNING] ${issue.description}`)
    }
  }
  lines.push("Address these issues as part of your update unless the user explicitly asked to ignore them.")
  lines.push("")

  return lines.join("\n")
}

/**
 * Returns true if the prompt is vague/general and should trigger a health check.
 */
export function isVaguePrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase().trim()
  if (!lower) return false

  const vaguePatterns = [
    /^make\s+it\s+(?:look\s+)?better\.?$/i,
    /^improve\s+(?:it|this|the\s+(?:design|page|ui|look))\.?$/i,
    /^(?:polish|refine|tweak|tighten\s+up)\b/i,
    /^(?:fix\s+it|make\s+it\s+(?:nice|good|great|beautiful|pretty))\.?$/i,
    /^(?:enhance|upgrade)\s+(?:it|this|the\s+(?:design|page|ui|look))\.?$/i,
  ]

  return vaguePatterns.some((p) => p.test(lower))
}
