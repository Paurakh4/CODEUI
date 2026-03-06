import { describe, expect, it, vi } from 'vitest'
import {
  detectIncompletePatchBlocks,
  StreamParser,
} from '../../../lib/parsers/stream-parser'

describe('StreamParser', () => {
  it('detects file updates and search/replace blocks', () => {
    const onFileUpdate = vi.fn()
    const onPatch = vi.fn()
    const parser = new StreamParser({ onFileUpdate, onPatch })

    const stream = [
      'Some intro text...',
      '<<<<<<< UPDATE_FILE_START index.html >>>>>>> UPDATE_FILE_END',
      '<<<<<<< SEARCH',
      'old code',
      '=======',
      'new code',
      '>>>>>>> REPLACE',
    ].join('\n')

    parser.parse(stream)

    expect(onFileUpdate).toHaveBeenCalledWith('index.html')
    expect(onPatch).toHaveBeenCalledWith('index.html', 'old code', 'new code')
  })

  it('deduplicates patches when parsing accumulated stream content', () => {
    const onPatch = vi.fn()
    const parser = new StreamParser({ onPatch })

    const partial = [
      '<<<<<<< UPDATE_FILE_START index.html >>>>>>> UPDATE_FILE_END',
      '<<<<<<< SEARCH',
      'old code',
      '=======',
      'new code',
    ].join('\n')

    const complete = `${partial}\n>>>>>>> REPLACE`

    parser.parse(partial)
    parser.parse(complete)
    parser.parse(complete)

    expect(onPatch).toHaveBeenCalledTimes(1)
  })

  it('resets processed state', () => {
    const onPatch = vi.fn()
    const parser = new StreamParser({ onPatch })

    const stream = [
      '<<<<<<< UPDATE_FILE_START index.html >>>>>>> UPDATE_FILE_END',
      '<<<<<<< SEARCH',
      'old code',
      '=======',
      'new code',
      '>>>>>>> REPLACE',
    ].join('\n')

    parser.parse(stream)
    parser.reset()
    parser.parse(stream)

    expect(onPatch).toHaveBeenCalledTimes(2)
  })

  it('tracks incomplete patch blocks', () => {
    const onIncompletePatch = vi.fn()
    const parser = new StreamParser({ onIncompletePatch })

    parser.parse('<<<<<<< SEARCH\nold\n=======\nnew')

    expect(onIncompletePatch).toHaveBeenCalledWith(1)
    expect(detectIncompletePatchBlocks('<<<<<<< SEARCH\nold\n=======\nnew')).toBe(1)
  })
})
