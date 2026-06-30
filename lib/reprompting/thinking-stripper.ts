/**
 * Shared thinking-tag stripper used by both the follow-up finalizer and
 * the JSON diff parser.
 *
 * Extracted into its own module to avoid circular imports between
 * follow-up-finalizer.ts and json-diff-parser.ts.
 */

const THINKING_TAG_PATTERNS: RegExp[] = [
  /<think(?:ing)?[^>]*>[\s\S]*?<\/think(?:ing)?>/gi,
  /<reasoning[^>]*>[\s\S]*?<\/reasoning>/gi,
  /<reflection[^>]*>[\s\S]*?<\/reflection>/gi,
  /<analysis[^>]*>[\s\S]*?<\/analysis>/gi,
  /<scratchpad[^>]*>[\s\S]*?<\/scratchpad>/gi,
]

// When output is truncated mid-thought, providers can leave an unmatched
// opening tag. Drop everything from the open tag up to the first DOCTYPE/html.
const UNCLOSED_THINKING_PATTERNS: RegExp[] = [
  /<think(?:ing)?[^>]*>[\s\S]*?(?=<!DOCTYPE|<html\b)/i,
  /<reasoning[^>]*>[\s\S]*?(?=<!DOCTYPE|<html\b)/i,
  /<reflection[^>]*>[\s\S]*?(?=<!DOCTYPE|<html\b)/i,
  /<analysis[^>]*>[\s\S]*?(?=<!DOCTYPE|<html\b)/i,
  /<scratchpad[^>]*>[\s\S]*?(?=<!DOCTYPE|<html\b)/i,
]

export function stripThinkingBlocks(content: string): string {
  let result = content
  for (const pattern of THINKING_TAG_PATTERNS) {
    result = result.replace(pattern, "")
  }
  for (const pattern of UNCLOSED_THINKING_PATTERNS) {
    result = result.replace(pattern, "")
  }
  return result
}
