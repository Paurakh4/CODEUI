import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PROJECT_NAME,
  deriveProjectNameFromPrompt,
  isDefaultProjectName,
  normalizeProjectName,
} from '@/lib/utils/project-name'

describe('project-name utils', () => {
  it('derives a concise title from prompt text', () => {
    expect(
      deriveProjectNameFromPrompt('Create a modern analytics dashboard with charts and KPIs.')
    ).toBe('Modern Analytics Dashboard')
  })

  it('falls back when prompt is empty', () => {
    expect(deriveProjectNameFromPrompt('')).toBe(DEFAULT_PROJECT_NAME)
  })

  it('normalizes whitespace and punctuation around names', () => {
    expect(normalizeProjectName('  New   Project---  ')).toBe('New Project')
  })

  it('detects default project naming variants', () => {
    expect(isDefaultProjectName('Untitled Project')).toBe(true)
    expect(isDefaultProjectName('untitled-project')).toBe(true)
    expect(isDefaultProjectName('Marketing Site')).toBe(false)
  })
})
