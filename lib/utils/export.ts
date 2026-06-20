const VOID_TAGS = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]

function kebabToCamel(input: string) {
  return input.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

function cssToReactStyleObject(cssText: string) {
  const declarations = cssText
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)

  if (declarations.length === 0) {
    return "{}"
  }

  const stylePairs = declarations
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(":")
      if (separatorIndex === -1) return null

      const property = declaration.slice(0, separatorIndex).trim()
      const value = declaration.slice(separatorIndex + 1).trim()
      if (!property || !value) return null

      return `${kebabToCamel(property)}: ${JSON.stringify(value)}`
    })
    .filter(Boolean)

  if (stylePairs.length === 0) {
    return "{}"
  }

  return `{ ${stylePairs.join(", ")} }`
}

function sanitizeMarkupForReact(markup: string) {
  let nextMarkup = markup

  nextMarkup = nextMarkup.replace(/<script[\s\S]*?<\/script>/gi, "")
  nextMarkup = nextMarkup.replace(/\sclass=/gi, " className=")
  nextMarkup = nextMarkup.replace(/\sfor=/gi, " htmlFor=")
  nextMarkup = nextMarkup.replace(/\son[a-z]+=("[^"]*"|'[^']*')/gi, "")

  nextMarkup = nextMarkup.replace(/\sstyle="([^"]*)"/gi, (_, styleText: string) => {
    return ` style={${cssToReactStyleObject(styleText)}}`
  })

  nextMarkup = nextMarkup.replace(/\sstyle='([^']*)'/gi, (_, styleText: string) => {
    return ` style={${cssToReactStyleObject(styleText)}}`
  })

  nextMarkup = nextMarkup.replace(/<!--([\s\S]*?)-->/g, (_, comment: string) => {
    const text = comment.trim().replace(/\*\//g, "")
    return `{/* ${text} */}`
  })

  for (const tag of VOID_TAGS) {
    const tagRegex = new RegExp(`<${tag}(\\s[^>]*?)?>`, "gi")
    nextMarkup = nextMarkup.replace(tagRegex, (match) => {
      if (match.endsWith("/>")) return match
      return match.replace(/>$/, " />")
    })
  }

  return nextMarkup.trim()
}

function safeTemplateText(input: string) {
  return input.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")
}

export function sanitizeFileName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "project"
}

export function sanitizeComponentName(name: string) {
  const normalized = name
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("")

  if (!normalized) return "ExportedComponent"
  return /^[A-Za-z_]/.test(normalized) ? normalized : `Component${normalized}`
}

export function convertHtmlToReactComponent(html: string, componentName: string) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : html

  const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
  const collectedStyles = styleMatches
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .join("\n\n")

  const jsxMarkup = sanitizeMarkupForReact(bodyContent)
  const indentedMarkup = jsxMarkup
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n")

  const safeStyles = safeTemplateText(collectedStyles)
  const safeComponentName = sanitizeComponentName(componentName)

  const styleBlock = safeStyles
    ? `      <style>{\`\n${safeStyles}\n\`}</style>\n`
    : ""

  return `import React from "react"

export default function ${safeComponentName}() {
  return (
    <>
${styleBlock}${indentedMarkup}
    </>
  )
}
`
}

export function generateExportPrompt(html: string, designMeta: { primaryColor: string; secondaryColor: string; theme: string }): string {
  // ponytail: bodyContent unused — we embed the full html verbatim, no need to extract
  const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
  const collectedStyles = styleMatches.map((m) => m[1]?.trim()).filter(Boolean).join("\n\n")

  const sectionTags = html.match(/<section[^>]*>/gi)?.length ?? 0
  const headerTags = html.match(/<header[^>]*>/gi)?.length ?? 0
  const footerTags = html.match(/<footer[^>]*>/gi)?.length ?? 0
  const navTags = html.match(/<nav[^>]*>/gi)?.length ?? 0
  const mainTags = html.match(/<main[^>]*>/gi)?.length ?? 0
  const articleTags = html.match(/<article[^>]*>/gi)?.length ?? 0
  const divTags = html.match(/<div[^>]*>/gi)?.length ?? 0
  const imgTags = html.match(/<img[^>]*>/gi)?.length ?? 0
  const buttonTags = html.match(/<button[^>]*>/gi)?.length ?? 0
  const aTags = html.match(/<a[^>]*>/gi)?.length ?? 0
  const formTags = html.match(/<form[^>]*>/gi)?.length ?? 0
  const inputTags = html.match(/<input[^>]*>/gi)?.length ?? 0
  const cardPatterns = (html.match(/class="[^"]*rounded[^"]*"/gi)?.length ?? 0)
  const gridPatterns = (html.match(/grid-cols|grid-flow/g)?.length ?? 0)

  // Detect actual background/text colors used to reinforce theme
  const bgClasses = [...html.matchAll(/(?:bg|background)[:-]#?[a-zA-Z0-9#]+(?:-[0-9]{2,3})?/gi)].map((m) => m[0])
  const textClasses = [...html.matchAll(/text-(?:white|black|zinc|slate|neutral|stone|gray)-(?:50|100|200|900|950|black|white)/gi)].map((m) => m[0])
  const bgValues = [...html.matchAll(/(?:background(?:-color)?|background):\s*(#[0-9a-fA-F]+|white|black|transparent)/gi)].map((m) => m[0])
  const hasLightBg = /bg-white|bg-zinc-50|bg-gray-50|bg-slate-50|bg-neutral-50|background:\s*white|background-color:\s*white|background:\s*#[fF]{3,6}|background-color:\s*#[fF]{3,6}/.test(html)
  const hasDarkBg = /bg-zinc-9[05]0|bg-gray-9[05]0|bg-slate-9[05]0|bg-neutral-9[05]0|bg-black|background:\s*black|background-color:\s*black|background:\s*#0[0a]/i.test(html)
  const detectedMode = hasLightBg && !hasDarkBg ? "light" : hasDarkBg && !hasLightBg ? "dark" : designMeta.theme
  const modeWarning = detectedMode !== designMeta.theme
    ? ` (manifest: ${designMeta.theme}, but actual HTML uses ${detectedMode} backgrounds — use ${detectedMode})`
    : ""

  // ponytail: colorValues parsed but not surfaced in prompt yet — could add "Detected Colors" section
  const hasAnimation = /animation|@keyframes|transition|transform/g.test(html)
  const hasMediaQuery = /@media/g.test(html)
  const hasFlexbox = /flex|flex-/g.test(html)
  const hasGrid = /grid/g.test(html)
  const hasGradient = /gradient/g.test(html)
  const hasShadow = /box-shadow/g.test(html)
  const hasBorder = /border/g.test(html)
  const hasFontFamily = /font-family/g.test(html)
  const hasGap = /gap/g.test(html)
  const hasPadding = /padding|p-/g.test(html)
  const hasMargin = /margin|m-/g.test(html)

  const layoutFeatures = [hasFlexbox && "Flexbox", hasGrid && "CSS Grid"].filter(Boolean).join(", ") || "Standard flow"
  const visualFeatures = [hasGradient && "Gradients", hasShadow && "Shadows", hasBorder && "Borders", hasAnimation && "Animations/Transitions", hasMediaQuery && "Responsive Media Queries", hasGap && "Gap/Spacing"].filter(Boolean).join(", ") || "None detected"

  const componentLines = [
    sectionTags && `${sectionTags} <section> elements`,
    headerTags && `${headerTags} <header> elements`,
    footerTags && `${footerTags} <footer> elements`,
    navTags && `${navTags} <nav> elements`,
    mainTags && `${mainTags} <main> elements`,
    articleTags && `${articleTags} <article> elements`,
    divTags && `${divTags} <div> containers`,
    imgTags && `${imgTags} <img> elements`,
    buttonTags && `${buttonTags} <button> elements`,
    aTags && `${aTags} <a> links`,
    formTags && `${formTags} <form> elements`,
    inputTags && `${inputTags} <input> fields`,
    cardPatterns && `${cardPatterns} card-like containers (rounded)`,
    gridPatterns && `Grid layouts detected`,
  ].filter(Boolean).join("\n")

  return `You are an expert UI developer. Recreate the following UI exactly as described.

## Design Language
- Design System: Custom (Tailwind-based)
- Primary Color: ${designMeta.primaryColor}
- Secondary Color: ${designMeta.secondaryColor}
- Color Scheme / Theme: ${detectedMode}${modeWarning}
- Layout Techniques: ${layoutFeatures}
- Visual Features: ${visualFeatures}
${hasFontFamily ? "- Typography: Custom font-family defined\n" : ""}${hasPadding ? "- Spacing: Padding/margin used for layout\n" : ""}${bgClasses.length > 0 ? `- Detected background classes: ${bgClasses.slice(0, 5).join(", ")}\n` : ""}${textClasses.length > 0 ? `- Detected text color classes: ${textClasses.slice(0, 5).join(", ")}\n` : ""}
## Component Inventory
${componentLines}

## Full HTML Code
\`\`\`html
${html}
\`\`\`
${collectedStyles ? `\n## Inline CSS
\`\`\`css
${collectedStyles}
\`\`\`` : ""}

## CRITICAL — Color Scheme Instructions
You MUST reproduce the UI using the EXACT color scheme detected above (${detectedMode} mode).
- If the scheme is "light": use white or light backgrounds (#fff, bg-white, bg-zinc-50, etc.), dark text (text-zinc-900, etc.), and light-appropriate shadows and borders.
- If the scheme is "dark": use dark backgrounds (bg-zinc-900, bg-black, etc.), light text (text-zinc-100, etc.), and dark-appropriate shadows and borders.
- DO NOT output the opposite scheme. If the reference is light mode, DO NOT generate dark mode, and vice versa.
- Match every background color, text color, border color, and accent color exactly as they appear in the HTML code above.

## Instructions
1. Use the same color palette, typography, spacing, and visual style shown above.
2. Maintain the exact same layout structure, component hierarchy, and responsive behavior.
3. Use Tailwind CSS classes for styling (preferred) or inline styles where needed.
4. Include all interactive elements (buttons, links, forms) with the same labels and states.
5. Reference the CSS code block for any custom styles, animations, or keyframes.
6. Match the overall visual density, alignment, and proportions precisely.
7. Output a single complete HTML file (or your framework's equivalent) that reproduces this UI faithfully.`
}
