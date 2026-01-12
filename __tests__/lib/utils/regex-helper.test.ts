import { describe, it, expect } from 'vitest';
// @ts-ignore
import { createFlexibleHtmlRegex, escapeRegExp } from '../../../lib/utils/regex-helper';

describe('escapeRegExp', () => {
  it('should escape special regex characters', () => {
    // Note: JS regex might not escape ] if it's not closing a class, which is fine.
    // My implementation escapes [ but not ] depending on the regex.
    const escaped = escapeRegExp('[].*+?^${}()|\\');
    expect(escaped).toContain('\\[');
    expect(escaped).toContain('\\.');
    expect(escaped).toContain('\\*');
  });
});

describe('createFlexibleHtmlRegex', () => {
  it('should match exact string', () => {
    const search = '<div class="btn">Click me</div>';
    const regex = createFlexibleHtmlRegex(search);
    expect(regex.test(search)).toBe(true);
  });

  it('should handle whitespace variations (AI hallucination: extra spaces)', () => {
    const search = '<div class="btn">Click me</div>';
    const actual = '<div  class="btn" >Click me</div >';
    const regex = createFlexibleHtmlRegex(search);
    expect(regex.test(actual)).toBe(true);
  });

  it('should handle newline variations', () => {
    const search = '<div>\n  <span>Hello</span>\n</div>';
    const actual = '<div> <span>Hello</span> </div>';
    const regex = createFlexibleHtmlRegex(search);
    expect(regex.test(actual)).toBe(true);
  });

  it('should handle space between tags', () => {
    const search = '<div></div><div></div>';
    const actual = '<div></div>  <div></div>';
    const regex = createFlexibleHtmlRegex(search);
    expect(regex.test(actual)).toBe(true);
  });

  it('should match multi-line blocks with varying indentation', () => {
    const search = `
<section>
  <h1>Title</h1>
  <p>Text</p>
</section>
    `.trim();
    
    const actual = `
<section >
    <h1>Title</h1>
<p>Text</p>
</section>
    `.trim();

    const regex = createFlexibleHtmlRegex(search);
    expect(actual).toMatch(regex);
  });

  it('should escape regex characters in search block', () => {
    const search = 'const x = (a + b) * c;';
    const regex = createFlexibleHtmlRegex(search);
    expect(regex.test(search)).toBe(true);
  });
});
