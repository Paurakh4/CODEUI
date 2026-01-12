/**
 * Estimates the number of tokens in a text string.
 * Uses a rough approximation of 1 token ~= 4 characters.
 * This is suitable for managing context limits before sending to LLMs.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
