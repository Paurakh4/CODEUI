import { describe, expect, it } from 'vitest'
import { createFlexibleHtmlRegex, escapeRegExp } from '../../../lib/utils/regex-helper'

describe('escapeRegExp', () => {
  it('escapes special regex characters', () => {
    const escaped = escapeRegExp('[].*+?^${}()|\\')
    expect(escaped).toContain('\\[')
    expect(escaped).toContain('\\.')
    expect(escaped).toContain('\\*')
  })
})

describe('createFlexibleHtmlRegex', () => {
  it('matches exact strings', () => {
    const search = '<div class="btn">Click me</div>'
    const regex = createFlexibleHtmlRegex(search)
    expect(regex.test(search)).toBe(true)
  })

  it('handles whitespace variations', () => {
    const search = '<div class="btn">Click me</div>'
    const actual = '<div  class="btn" >Click me</div >'
    expect(actual).toMatch(createFlexibleHtmlRegex(search))
  })

  it('matches single and double quotes interchangeably', () => {
    const search = '<button class="cta">Go</button>'
    const actual = "<button class='cta'>Go</button>"
    expect(actual).toMatch(createFlexibleHtmlRegex(search))
  })

  it('allows flexible delimiter spacing', () => {
    const search = 'const total=(price+tax);'
    const actual = 'const total = ( price + tax ) ;'
    expect(actual).toMatch(createFlexibleHtmlRegex(search))
  })

  it('handles multi-line blocks with varying indentation', () => {
    const search = ['<section>', '  <h1>Title</h1>', '  <p>Text</p>', '</section>'].join('\n')
    const actual = ['<section >', '    <h1>Title</h1>', '<p>Text</p>', '</section>'].join('\n')
    expect(actual).toMatch(createFlexibleHtmlRegex(search))
  })

  it('returns a safe regex for empty input', () => {
    const regex = createFlexibleHtmlRegex('   ')
    expect(regex.test('')).toBe(true)
    expect(regex.test('content')).toBe(false)
  })
})
