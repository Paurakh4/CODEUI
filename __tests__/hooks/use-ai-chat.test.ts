import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applySearchReplace, extractHtml, useAIChat } from '@/hooks/use-ai-chat'

function createSseResponse(events: string[]) {
  const encodedEvents = events.map((event) => new TextEncoder().encode(event))
  let index = 0

  return {
    ok: true,
    body: {
      getReader: () => ({
        read: vi.fn(async () => {
          if (index < encodedEvents.length) {
            return { done: false, value: encodedEvents[index++] }
          }

          return { done: true, value: undefined }
        }),
      }),
    },
  }
}

describe('useAIChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('propagates explicit recovery mode in completion callback', async () => {
    const onComplete = vi.fn()

    global.fetch = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"type":"content","data":"<!DOCTYPE html><html><body>Recovered</body></html>"}\n\n',
      ])
    ) as any

    const { result } = renderHook(() =>
      useAIChat({
        onComplete,
      })
    )

    await act(async () => {
      await result.current.sendMessage({
        prompt: 'recover the previous update',
        isFollowUp: true,
        recoveryMode: 'full-document',
      })
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        recoveryMode: true,
      })
    )
  })

  it('keeps newest request active when previous request is aborted', async () => {
    const onComplete = vi.fn()

    let firstRequestAborted = false

    global.fetch = vi
      .fn()
      .mockImplementationOnce((_url, init: RequestInit) => {
        const signal = init.signal as AbortSignal

        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            firstRequestAborted = true
            const abortError = new Error('aborted')
            abortError.name = 'AbortError'
            reject(abortError)
          })
        })
      })
      .mockResolvedValueOnce(
        createSseResponse([
          'data: {"type":"content","data":"<!DOCTYPE html><html><body>Latest</body></html>"}\n\n',
        ])
      ) as any

    const { result } = renderHook(() =>
      useAIChat({
        onComplete,
      })
    )

    let firstPromise: Promise<string | null>
    await act(async () => {
      firstPromise = result.current.sendMessage({
        prompt: 'first request',
        isFollowUp: true,
      })
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.sendMessage({
        prompt: 'second request',
        isFollowUp: true,
      })
    })

    await expect(firstPromise!).resolves.toBeNull()
    expect(firstRequestAborted).toBe(true)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        extractedHtml: '<!DOCTYPE html><html><body>Latest</body></html>',
      })
    )
  })

  it('reports incomplete patch blocks in completion callback', async () => {
    const onComplete = vi.fn()

    global.fetch = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"type":"content","data":"<<<<<<< SEARCH\\n<div>old</div>\\n=======\\n<div>new</div>"}\n\n',
      ])
    ) as any

    const { result } = renderHook(() =>
      useAIChat({
        onComplete,
      })
    )

    await act(async () => {
      await result.current.sendMessage({
        prompt: 'update the div',
        isFollowUp: true,
      })
    })

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        incompletePatches: 1,
      })
    )
  })
})

describe('useAIChat helpers', () => {
  it('extracts complete HTML documents', () => {
    const content = 'prefix <!DOCTYPE html><html><body><h1>Hello</h1></body></html> suffix'
    expect(extractHtml(content)).toBe('<!DOCTYPE html><html><body><h1>Hello</h1></body></html>')
  })

  it('returns empty string for incomplete HTML documents', () => {
    expect(extractHtml('<html><body><h1>Hello</h1>')).toBe('')
  })

  it('applies multiple patches sequentially', () => {
    const original = ['<main>', '  <h1>Old title</h1>', '  <p>Old body</p>', '</main>'].join('\n')
    const response = [
      '<<<<<<< SEARCH',
      '  <h1>Old title</h1>',
      '=======',
      '  <h1>New title</h1>',
      '>>>>>>> REPLACE',
      '<<<<<<< SEARCH',
      '  <p>Old body</p>',
      '=======',
      '  <p>New body</p>',
      '>>>>>>> REPLACE',
    ].join('\n')

    const result = applySearchReplace(original, response)

    expect(result).toContain('New title')
    expect(result).toContain('New body')
  })
})
