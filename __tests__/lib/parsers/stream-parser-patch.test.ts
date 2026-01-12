import { describe, it, expect, vi } from 'vitest';
// @ts-ignore
import { StreamParser } from '../../../lib/parsers/stream-parser';

describe('StreamParser Patch Application', () => {
  it('should apply a basic patch successfully', () => {
    const onPatch = vi.fn((filePath, search, replace) => {
        const result = parser.applyPatch('<div>old</div>', search, replace);
        expect(result.success).toBe(true);
        expect(result.content).toBe('<div>new</div>');
    });
    const parser = new StreamParser({ onPatch });

    const stream = [
      '<<<<<<< UPDATE_FILE_START index.html >>>>>>> UPDATE_FILE_END',
      '<<<<<<< SEARCH',
      '<div>old</div>',
      '=======',
      '<div>new</div>',
      '>>>>>>> REPLACE',
    ].join('\n');

    parser.parse(stream);
    expect(onPatch).toHaveBeenCalled();
  });

  it('should handle deletions (empty replace block)', () => {
    const onPatch = vi.fn((filePath, search, replace) => {
        const result = parser.applyPatch('<div>old</div><span>keep</span>', search, replace);
        expect(result.success).toBe(true);
        expect(result.content).toBe('<span>keep</span>');
    });
    const parser = new StreamParser({ onPatch });

    const stream = [
      '<<<<<<< UPDATE_FILE_START index.html >>>>>>> UPDATE_FILE_END',
      '<<<<<<< SEARCH',
      '<div>old</div>',
      '=======',
      '>>>>>>> REPLACE',
    ].join('\n');

    parser.parse(stream);
    expect(onPatch).toHaveBeenCalled();
  });

  it('should return failure if search block does not match', () => {
    const onPatch = vi.fn((filePath, search, replace) => {
        const result = parser.applyPatch('<div>other</div>', search, replace);
        expect(result.success).toBe(false);
    });
    const parser = new StreamParser({ onPatch });

    const stream = [
      '<<<<<<< UPDATE_FILE_START index.html >>>>>>> UPDATE_FILE_END',
      '<<<<<<< SEARCH',
      '<div>old</div>',
      '=======',
      '<div>new</div>',
      '>>>>>>> REPLACE',
    ].join('\n');

    parser.parse(stream);
  });

  it('should use flexible regex to match variations', () => {
      const onPatch = vi.fn((filePath, search, replace) => {
          const result = parser.applyPatch('<div  class="btn" >old</div >', search, replace);
          expect(result.success).toBe(true);
          expect(result.content).toBe('<div>new</div>');
      });
      const parser = new StreamParser({ onPatch });
  
      const stream = [
        '<<<<<<< UPDATE_FILE_START index.html >>>>>>> UPDATE_FILE_END',
        '<<<<<<< SEARCH',
        '<div class="btn">old</div>',
        '=======',
        '<div>new</div>',
        '>>>>>>> REPLACE',
      ].join('\n');
  
      parser.parse(stream);
  });
});
