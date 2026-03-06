/**
 * Escapes special regex characters in a string.
 */
export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const OPTIONAL_WHITESPACE = "\\s*"
const DELIMITER_PATTERN = new Set(["(", ")", "{", "}", "[", "]", "=", ";", ",", ":", "<", ">", "+", "-", "*", "/"])

const collapseWhitespacePatterns = (pattern: string): string => {
  return pattern.replace(/(?:\\s\*){2,}/g, OPTIONAL_WHITESPACE)
}

/**
 * Creates a flexible regex from a search block that matches even if
 * there are minor whitespace or newline variations (AI hallucinations).
 */
export const createFlexibleHtmlRegex = (searchBlock: string): RegExp => {
  const normalized = searchBlock.trim()

  if (!normalized) {
    return /^$/s
  }

  let pattern = ""

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]

    if (/\s/.test(char)) {
      while (index + 1 < normalized.length && /\s/.test(normalized[index + 1])) {
        index += 1
      }

      pattern += OPTIONAL_WHITESPACE
      continue
    }

    if (char === "'" || char === '"') {
      pattern += `["']`
      continue
    }

    if (DELIMITER_PATTERN.has(char)) {
      pattern += `${OPTIONAL_WHITESPACE}${escapeRegExp(char)}${OPTIONAL_WHITESPACE}`
      continue
    }

    pattern += escapeRegExp(char)
  }

  return new RegExp(collapseWhitespacePatterns(pattern), "s")
}
