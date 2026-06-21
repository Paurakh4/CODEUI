import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fast djb2 hash for code version comparison.
 * Returns a 32-bit hex string. Not cryptographically secure — only used
 * for change detection (preview sync, undo/redo guards).
 */
export function fastHash(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}
