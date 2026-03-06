import { describe, expect, it } from 'vitest'
import { StreamParser } from '../../../lib/parsers/stream-parser'

describe('StreamParser patch application', () => {
  it('applies a basic patch successfully', () => {
    const parser = new StreamParser({})
    const result = parser.applyPatch('<div>old</div>', '<div>old</div>', '<div>new</div>', 'index.html')

    expect(result.success).toBe(true)
    expect(result.content).toBe('<div>new</div>')
    expect(result.tier).toBe('exact')
  })

  it('supports prepend inserts with empty search blocks', () => {
    const parser = new StreamParser({})
    const result = parser.applyPatch('<main>Body</main>', '', '<style>body{color:red;}</style>', 'index.html')

    expect(result.success).toBe(true)
    expect(result.content.startsWith('<style>body{color:red;}</style>')).toBe(true)
    expect(result.tier).toBe('prepend')
  })

  it('applies patches when search differs only by surrounding whitespace', () => {
    const parser = new StreamParser({})
    const result = parser.applyPatch('<div>old</div>', '  <div>old</div>  ', '<div>new</div>', 'index.html')

    expect(result.success).toBe(true)
    expect(result.tier).toBe('trimmed')
  })

  it('applies patches when indentation differs', () => {
    const parser = new StreamParser({})
    const current = ['<ul>', '    <li>First</li>', '    <li>Second</li>', '</ul>'].join('\n')
    const search = ['<ul>', '  <li>First</li>', '  <li>Second</li>', '</ul>'].join('\n')
    const replace = ['<ul>', '  <li>First</li>', '  <li>Second Updated</li>', '</ul>'].join('\n')

    const result = parser.applyPatch(current, search, replace, 'index.html')

    expect(result.success).toBe(true)
    expect(result.content).toContain('Second Updated')
  })

  it('matches quote variations via flexible regex', () => {
    const parser = new StreamParser({})
    const current = "<button class='btn primary'>Save</button>"
    const search = '<button class="btn primary">Save</button>'
    const replace = '<button class="btn primary">Saved</button>'

    const result = parser.applyPatch(current, search, replace, 'index.html')

    expect(result.success).toBe(true)
    expect(result.content).toContain('Saved')
  })

  it('preserves CRLF line endings', () => {
    const parser = new StreamParser({})
    const current = '<div>\r\n  <span>old</span>\r\n</div>'
    const search = '<div>\n  <span>old</span>\n</div>'
    const replace = '<div>\n  <span>new</span>\n</div>'

    const result = parser.applyPatch(current, search, replace, 'index.html')

    expect(result.success).toBe(true)
    expect(result.content).toContain('\r\n')
    expect(result.content).toContain('new')
  })

  it('returns failure when search block does not match', () => {
    const parser = new StreamParser({})
    const result = parser.applyPatch('<div>other</div>', '<div>old</div>', '<div>new</div>', 'index.html')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Could not find match')
  })
})
