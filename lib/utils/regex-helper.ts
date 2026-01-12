/**
 * Escapes special regex characters in a string.
 */
export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Creates a flexible regex from a search block that matches even if
 * there are minor whitespace or newline variations (AI hallucinations).
 */
export const createFlexibleHtmlRegex = (searchBlock: string): RegExp => {
  let searchRegex = escapeRegExp(searchBlock)
    .replace(/\s+/g, '\\s*')       // Match any amount of whitespace
    .replace(/>\s*</g, '>\\s*<')    // Match spaces between tags
    .replace(/\s*>/g, '\\s*>');    // Match spaces before tag closing
  
  // Use 'g' flag for multiple replacements if needed
  // Use 's' flag (dotAll) to match newlines with '.'
  return new RegExp(searchRegex, 'gs');
};
