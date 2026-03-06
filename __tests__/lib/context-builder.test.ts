import { describe, expect, it } from 'vitest'
import { buildContext, type ContextInput } from '../../lib/context-builder'

describe('buildContext', () => {
  it('includes the current file content', () => {
    const input: ContextInput = {
      currentFile: { name: 'index.html', content: '<html>...</html>' },
    }

    const context = buildContext(input)

    expect(context).toContain('Current file: index.html')
    expect(context).toContain('<html>...</html>')
  })

  it('includes selected element if provided', () => {
    const input: ContextInput = {
      currentFile: { name: 'index.html', content: '<html><body><button>Click</button></body></html>' },
      selectedElement: '<button>Click</button>',
    }

    const context = buildContext(input)

    expect(context).toContain('Update ONLY this element:')
    expect(context).toContain('<button>Click</button>')
  })

  it('includes other files when budget allows', () => {
    const input: ContextInput = {
      currentFile: { name: 'index.html', content: '<html></html>' },
      otherFiles: [{ name: 'style.css', content: 'body { color: red; }' }],
      maxTokens: 500,
    }

    const context = buildContext(input)

    expect(context).toContain('File: style.css')
    expect(context).toContain('body { color: red; }')
  })

  it('omits other files when token budget is exhausted', () => {
    const input: ContextInput = {
      currentFile: { name: 'index.html', content: '<html>' + 'x'.repeat(4000) + '</html>' },
      otherFiles: [{ name: 'style.css', content: 'body { color: red; }' }],
      maxTokens: 200,
    }

    const context = buildContext(input)

    expect(context).not.toContain('File: style.css')
  })

  it('truncates large current files to stay within budget', () => {
    const largeContent = `<html><head></head><body>${'a'.repeat(20_000)}</body></html>`
    const context = buildContext({
      currentFile: { name: 'index.html', content: largeContent },
      selectedElement: '<body>',
      maxTokens: 300,
    })

    expect(context).toContain('Context note: The current file was truncated')
    expect(context).toContain('<!-- ... truncated for token budget ... -->')
  })

  it('uses model-aware token budgets when maxTokens is omitted', () => {
    const context = buildContext({
      currentFile: { name: 'index.html', content: '<html><body>hello</body></html>' },
      modelId: 'deepseek/deepseek-chat',
    })

    expect(context).toContain('Current file: index.html')
    expect(context.startsWith('\nCurrent file: index.html')).toBe(true)
  })
})
