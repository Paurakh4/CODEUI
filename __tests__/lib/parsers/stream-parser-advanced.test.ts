import { describe, expect, it, vi } from 'vitest'
import {
  StreamParser,
  validateAIResponse,
} from '../../../lib/parsers/stream-parser'

describe('StreamParser advanced markers', () => {
  it('detects project name updates', () => {
    const onProjectNameUpdate = vi.fn()
    const parser = new StreamParser({ onProjectNameUpdate })

    parser.parse('<<<<<<< PROJECT_NAME_START\nMy Awesome Project\n>>>>>>> PROJECT_NAME_END')

    expect(onProjectNameUpdate).toHaveBeenCalledWith('My Awesome Project')
  })

  it('detects new file creation', () => {
    const onNewFile = vi.fn()
    const parser = new StreamParser({ onNewFile })

    parser.parse('<<<<<<< NEW_FILE_START\nstyles.css\n=======\nbody { background: blue; }\n>>>>>>> NEW_FILE_END')

    expect(onNewFile).toHaveBeenCalledWith('styles.css', 'body { background: blue; }')
  })

  it('does not re-process the same project marker in one session', () => {
    const onProjectNameUpdate = vi.fn()
    const parser = new StreamParser({ onProjectNameUpdate })

    parser.parse('<<<<<<< PROJECT_NAME_START Project A >>>>>>> PROJECT_NAME_END')
    parser.parse('<<<<<<< PROJECT_NAME_START Project A >>>>>>> PROJECT_NAME_END')

    expect(onProjectNameUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('validateAIResponse', () => {
  it('rejects empty responses', () => {
    expect(validateAIResponse('   ')).toEqual({ valid: false, reason: 'Empty AI response' })
  })

  it('rejects narration-only responses', () => {
    expect(validateAIResponse('Here is what I changed for you.')).toEqual({
      valid: false,
      reason: 'AI response contained narration without actionable HTML or patches',
    })
  })

  it('accepts patch-based responses', () => {
    expect(validateAIResponse('<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE')).toEqual({ valid: true })
  })
})
