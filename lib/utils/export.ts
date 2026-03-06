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
