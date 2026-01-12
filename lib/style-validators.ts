"use client"

// ============================================================================
// STYLE VALIDATION UTILITIES
// ============================================================================

export interface ValidationResult {
  isValid: boolean
  sanitizedValue: string | number
  error?: string
  warning?: string
}

export type StyleValidator = (value: string | number) => ValidationResult

// ============================================================================
// VALUE PARSERS
// ============================================================================

/**
 * Parse a CSS length value (e.g., "100px", "50%", "10rem")
 */
export function parseCSSLength(value: string): { value: number; unit: string } | null {
  const match = value.match(/^(-?[\d.]+)(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)?$/i)
  if (!match) return null
  return {
    value: parseFloat(match[1]),
    unit: match[2] || "px",
  }
}

/**
 * Parse a color value and validate it
 */
export function parseColor(value: string): { isValid: boolean; normalized: string } {
  // Handle hex colors
  if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
    // Convert 3-char hex to 6-char
    const r = value[1]
    const g = value[2]
    const b = value[3]
    return { isValid: true, normalized: `#${r}${r}${g}${g}${b}${b}` }
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    return { isValid: true, normalized: value.toLowerCase() }
  }
  if (/^#[0-9A-Fa-f]{8}$/.test(value)) {
    return { isValid: true, normalized: value.toLowerCase() }
  }

  // Handle rgb/rgba
  const rgbMatch = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i)
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1])))
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2])))
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3])))
    const a = rgbMatch[4] ? Math.min(1, Math.max(0, parseFloat(rgbMatch[4]))) : 1
    if (a === 1) {
      return { isValid: true, normalized: `rgb(${r}, ${g}, ${b})` }
    }
    return { isValid: true, normalized: `rgba(${r}, ${g}, ${b}, ${a})` }
  }

  // Handle hsl/hsla
  const hslMatch = value.match(/^hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)$/i)
  if (hslMatch) {
    const h = parseInt(hslMatch[1]) % 360
    const s = Math.min(100, Math.max(0, parseFloat(hslMatch[2])))
    const l = Math.min(100, Math.max(0, parseFloat(hslMatch[3])))
    const a = hslMatch[4] ? Math.min(1, Math.max(0, parseFloat(hslMatch[4]))) : 1
    if (a === 1) {
      return { isValid: true, normalized: `hsl(${h}, ${s}%, ${l}%)` }
    }
    return { isValid: true, normalized: `hsla(${h}, ${s}%, ${l}%, ${a})` }
  }

  // Handle named colors
  const namedColors = [
    "transparent", "inherit", "initial", "currentColor",
    "black", "white", "red", "green", "blue", "yellow", "cyan", "magenta",
    "gray", "grey", "orange", "pink", "purple", "brown", "navy", "teal",
    "olive", "maroon", "aqua", "fuchsia", "lime", "silver",
  ]
  if (namedColors.includes(value.toLowerCase())) {
    return { isValid: true, normalized: value.toLowerCase() }
  }

  return { isValid: false, normalized: value }
}

// ============================================================================
// STYLE VALIDATORS
// ============================================================================

/**
 * Validate dimension values (width, height, min-width, etc.)
 */
export function validateDimension(value: string | number): ValidationResult {
  if (typeof value === "number") {
    return { isValid: true, sanitizedValue: `${value}px` }
  }

  const trimmed = value.trim()
  
  // Handle special keywords
  if (["auto", "inherit", "initial", "unset", "fit-content", "max-content", "min-content", "none"].includes(trimmed)) {
    return { isValid: true, sanitizedValue: trimmed }
  }

  // Handle calc()
  if (trimmed.startsWith("calc(")) {
    // Basic validation - check for balanced parentheses
    const openCount = (trimmed.match(/\(/g) || []).length
    const closeCount = (trimmed.match(/\)/g) || []).length
    if (openCount === closeCount) {
      return { isValid: true, sanitizedValue: trimmed }
    }
    return { isValid: false, sanitizedValue: value, error: "Unbalanced parentheses in calc()" }
  }

  // Parse as length
  const parsed = parseCSSLength(trimmed)
  if (parsed) {
    // Warn about negative values for certain properties
    if (parsed.value < 0) {
      return {
        isValid: true,
        sanitizedValue: `${parsed.value}${parsed.unit}`,
        warning: "Negative dimension values may cause unexpected layout",
      }
    }
    return { isValid: true, sanitizedValue: `${parsed.value}${parsed.unit}` }
  }

  return {
    isValid: false,
    sanitizedValue: value,
    error: "Invalid dimension format. Use values like '100px', '50%', or 'auto'",
  }
}

/**
 * Validate spacing values (margin, padding)
 */
export function validateSpacing(value: string | number): ValidationResult {
  if (typeof value === "number") {
    return { isValid: true, sanitizedValue: `${value}px` }
  }

  const trimmed = value.trim()

  // Handle special keywords
  if (["auto", "inherit", "initial", "unset"].includes(trimmed)) {
    return { isValid: true, sanitizedValue: trimmed }
  }

  // Parse as length
  const parsed = parseCSSLength(trimmed)
  if (parsed) {
    return { isValid: true, sanitizedValue: `${parsed.value}${parsed.unit}` }
  }

  // Handle shorthand (1-4 values)
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 1 && parts.length <= 4) {
    const validParts = parts.map((part) => {
      if (part === "auto") return part
      const partParsed = parseCSSLength(part)
      return partParsed ? `${partParsed.value}${partParsed.unit}` : null
    })

    if (validParts.every((p) => p !== null)) {
      return { isValid: true, sanitizedValue: validParts.join(" ") }
    }
  }

  return {
    isValid: false,
    sanitizedValue: value,
    error: "Invalid spacing format. Use values like '10px', '1rem', or 'auto'",
  }
}

/**
 * Validate color values
 */
export function validateColor(value: string | number): ValidationResult {
  if (typeof value === "number") {
    return {
      isValid: false,
      sanitizedValue: value,
      error: "Color values must be strings",
    }
  }

  const trimmed = value.trim()
  const { isValid, normalized } = parseColor(trimmed)

  if (isValid) {
    return { isValid: true, sanitizedValue: normalized }
  }

  return {
    isValid: false,
    sanitizedValue: value,
    error: "Invalid color format. Use hex (#fff), rgb(), or named colors",
  }
}

/**
 * Validate font size
 */
export function validateFontSize(value: string | number): ValidationResult {
  if (typeof value === "number") {
    if (value <= 0) {
      return {
        isValid: false,
        sanitizedValue: value,
        error: "Font size must be greater than 0",
      }
    }
    return { isValid: true, sanitizedValue: `${value}px` }
  }

  const trimmed = value.trim()

  // Handle special keywords
  const sizeKeywords = [
    "inherit", "initial", "unset",
    "xx-small", "x-small", "small", "medium", "large", "x-large", "xx-large",
    "smaller", "larger",
  ]
  if (sizeKeywords.includes(trimmed)) {
    return { isValid: true, sanitizedValue: trimmed }
  }

  const parsed = parseCSSLength(trimmed)
  if (parsed) {
    if (parsed.value <= 0) {
      return {
        isValid: false,
        sanitizedValue: value,
        error: "Font size must be greater than 0",
      }
    }
    return { isValid: true, sanitizedValue: `${parsed.value}${parsed.unit}` }
  }

  return {
    isValid: false,
    sanitizedValue: value,
    error: "Invalid font size. Use values like '16px', '1.2rem', or 'medium'",
  }
}

/**
 * Validate font weight
 */
export function validateFontWeight(value: string | number): ValidationResult {
  if (typeof value === "number") {
    if (value >= 100 && value <= 900 && value % 100 === 0) {
      return { isValid: true, sanitizedValue: value }
    }
    // Allow numeric values outside typical range with warning
    if (value >= 1 && value <= 1000) {
      return {
        isValid: true,
        sanitizedValue: value,
        warning: "Font weight values are typically 100-900 in increments of 100",
      }
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    
    // Handle keywords
    const weightKeywords = ["normal", "bold", "bolder", "lighter", "inherit", "initial", "unset"]
    if (weightKeywords.includes(trimmed)) {
      return { isValid: true, sanitizedValue: trimmed }
    }

    // Try parsing as number
    const num = parseInt(trimmed)
    if (!isNaN(num) && num >= 100 && num <= 900) {
      return { isValid: true, sanitizedValue: num }
    }
  }

  return {
    isValid: false,
    sanitizedValue: value,
    error: "Invalid font weight. Use values like 400, 700, 'normal', or 'bold'",
  }
}

/**
 * Validate opacity
 */
export function validateOpacity(value: string | number): ValidationResult {
  let num: number

  if (typeof value === "number") {
    num = value
  } else {
    num = parseFloat(value.trim())
    if (isNaN(num)) {
      return {
        isValid: false,
        sanitizedValue: value,
        error: "Opacity must be a number between 0 and 1",
      }
    }
  }

  // Clamp to valid range
  const clamped = Math.min(1, Math.max(0, num))
  
  if (clamped !== num) {
    return {
      isValid: true,
      sanitizedValue: clamped,
      warning: `Opacity clamped from ${num} to ${clamped}`,
    }
  }

  return { isValid: true, sanitizedValue: clamped }
}

/**
 * Validate border radius
 */
export function validateBorderRadius(value: string | number): ValidationResult {
  if (typeof value === "number") {
    if (value < 0) {
      return {
        isValid: false,
        sanitizedValue: value,
        error: "Border radius cannot be negative",
      }
    }
    return { isValid: true, sanitizedValue: `${value}px` }
  }

  const trimmed = value.trim()

  // Handle special keywords
  if (["inherit", "initial", "unset"].includes(trimmed)) {
    return { isValid: true, sanitizedValue: trimmed }
  }

  // Parse as single length
  const parsed = parseCSSLength(trimmed)
  if (parsed) {
    if (parsed.value < 0) {
      return {
        isValid: false,
        sanitizedValue: value,
        error: "Border radius cannot be negative",
      }
    }
    return { isValid: true, sanitizedValue: `${parsed.value}${parsed.unit}` }
  }

  // Handle shorthand (up to 4 values or with /)
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 1 && parts.length <= 4) {
    const validParts = parts.map((part) => {
      const partParsed = parseCSSLength(part)
      return partParsed && partParsed.value >= 0
        ? `${partParsed.value}${partParsed.unit}`
        : null
    })

    if (validParts.every((p) => p !== null)) {
      return { isValid: true, sanitizedValue: validParts.join(" ") }
    }
  }

  return {
    isValid: false,
    sanitizedValue: value,
    error: "Invalid border radius. Use values like '8px', '50%', or '4px 8px'",
  }
}

/**
 * Validate border width
 */
export function validateBorderWidth(value: string | number): ValidationResult {
  if (typeof value === "number") {
    if (value < 0) {
      return {
        isValid: false,
        sanitizedValue: value,
        error: "Border width cannot be negative",
      }
    }
    return { isValid: true, sanitizedValue: `${value}px` }
  }

  const trimmed = value.trim()

  // Handle keywords
  if (["thin", "medium", "thick", "inherit", "initial", "unset"].includes(trimmed)) {
    return { isValid: true, sanitizedValue: trimmed }
  }

  const parsed = parseCSSLength(trimmed)
  if (parsed) {
    if (parsed.value < 0) {
      return {
        isValid: false,
        sanitizedValue: value,
        error: "Border width cannot be negative",
      }
    }
    return { isValid: true, sanitizedValue: `${parsed.value}${parsed.unit}` }
  }

  return {
    isValid: false,
    sanitizedValue: value,
    error: "Invalid border width. Use values like '1px', '2px', or 'thin'",
  }
}

/**
 * Validate line height
 */
export function validateLineHeight(value: string | number): ValidationResult {
  if (typeof value === "number") {
    if (value < 0) {
      return {
        isValid: false,
        sanitizedValue: value,
        error: "Line height cannot be negative",
      }
    }
    return { isValid: true, sanitizedValue: value }
  }

  const trimmed = value.trim()

  // Handle keywords
  if (["normal", "inherit", "initial", "unset"].includes(trimmed)) {
    return { isValid: true, sanitizedValue: trimmed }
  }

  // Handle unitless number
  const num = parseFloat(trimmed)
  if (!isNaN(num) && num >= 0 && trimmed === String(num)) {
    return { isValid: true, sanitizedValue: num }
  }

  // Handle length
  const parsed = parseCSSLength(trimmed)
  if (parsed && parsed.value >= 0) {
    return { isValid: true, sanitizedValue: `${parsed.value}${parsed.unit}` }
  }

  return {
    isValid: false,
    sanitizedValue: value,
    error: "Invalid line height. Use values like '1.5', '24px', or 'normal'",
  }
}

/**
 * Validate box shadow
 */
export function validateBoxShadow(value: string | number): ValidationResult {
  if (typeof value === "number") {
    return {
      isValid: false,
      sanitizedValue: value,
      error: "Box shadow must be a string value",
    }
  }

  const trimmed = value.trim()

  // Handle keywords
  if (["none", "inherit", "initial", "unset"].includes(trimmed)) {
    return { isValid: true, sanitizedValue: trimmed }
  }

  // Basic validation - check for common patterns
  // Box shadow: [inset] x y [blur] [spread] color
  const shadowRegex = /^(inset\s+)?(-?[\d.]+)(px|em|rem)?\s+(-?[\d.]+)(px|em|rem)?(\s+(-?[\d.]+)(px|em|rem)?)?(\s+(-?[\d.]+)(px|em|rem)?)?(\s+.+)?$/i
  
  if (shadowRegex.test(trimmed) || trimmed.includes("rgba(") || trimmed.includes("rgb(") || trimmed.includes("#")) {
    return { isValid: true, sanitizedValue: trimmed }
  }

  return {
    isValid: true, // Be lenient with box-shadow
    sanitizedValue: trimmed,
    warning: "Complex box shadow - verify the value is correct",
  }
}

/**
 * Validate generic text values (font-family, etc.)
 */
export function validateGenericText(value: string | number): ValidationResult {
  if (typeof value === "number") {
    return { isValid: true, sanitizedValue: String(value) }
  }
  return { isValid: true, sanitizedValue: value.trim() }
}

// ============================================================================
// VALIDATOR MAP
// ============================================================================

export const STYLE_VALIDATORS: Record<string, StyleValidator> = {
  // Dimensions
  width: validateDimension,
  height: validateDimension,
  minWidth: validateDimension,
  maxWidth: validateDimension,
  minHeight: validateDimension,
  maxHeight: validateDimension,

  // Spacing
  margin: validateSpacing,
  marginTop: validateSpacing,
  marginRight: validateSpacing,
  marginBottom: validateSpacing,
  marginLeft: validateSpacing,
  padding: validateSpacing,
  paddingTop: validateSpacing,
  paddingRight: validateSpacing,
  paddingBottom: validateSpacing,
  paddingLeft: validateSpacing,
  gap: validateSpacing,

  // Colors
  color: validateColor,
  backgroundColor: validateColor,
  borderColor: validateColor,

  // Typography
  fontSize: validateFontSize,
  fontWeight: validateFontWeight,
  lineHeight: validateLineHeight,
  letterSpacing: validateSpacing,
  fontFamily: validateGenericText,

  // Border
  borderRadius: validateBorderRadius,
  borderWidth: validateBorderWidth,

  // Effects
  opacity: validateOpacity,
  boxShadow: validateBoxShadow,
}

/**
 * Validate a style value for a given property
 */
export function validateStyleValue(
  property: string,
  value: string | number
): ValidationResult {
  const validator = STYLE_VALIDATORS[property]
  if (validator) {
    return validator(value)
  }
  // Default: accept any value
  return { isValid: true, sanitizedValue: value }
}

/**
 * Validate multiple style properties
 */
export function validateStyles(
  styles: Record<string, string | number>
): Record<string, ValidationResult> {
  const results: Record<string, ValidationResult> = {}
  for (const [property, value] of Object.entries(styles)) {
    results[property] = validateStyleValue(property, value)
  }
  return results
}
