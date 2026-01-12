import { describe, it, expect, vi } from 'vitest';
// @ts-ignore
import { StreamParser } from '../../../lib/parsers/stream-parser';

describe('StreamParser', () => {
  it('should detect file updates and search/replace blocks', () => {
    const onFileUpdate = vi.fn();
    const onPatch = vi.fn();
    const parser = new StreamParser({ onFileUpdate, onPatch });

        const stream = [
          'Some intro text...',
          '<<<<<<< UPDATE_FILE_START index.html >>>>>>> UPDATE_FILE_END',
          '<<<<<<< SEARCH',
          'old code',
          '=======',
          'new code',
          '>>>>>>> REPLACE',
          'Outro text...'
        ].join('\n');
    
        parser.parse(stream);
        expect(onFileUpdate).toHaveBeenCalledWith('index.html');
    expect(onPatch).toHaveBeenCalledWith('index.html', 'old code', 'new code');
  });

  it('should handle multiple patches in one file', () => {
    const onPatch = vi.fn();
    const parser = new StreamParser({ onPatch });

    const stream = [
      '<<<<<<< UPDATE_FILE_START index.html >>>>>>> UPDATE_FILE_END',
      '<<<<<<< SEARCH',
      'block 1 old',
      '=======',
      'block 1 new',
      '>>>>>>> REPLACE',
      '<<<<<<< SEARCH',
      'block 2 old',
      '=======',
      'block 2 new',
      '>>>>>>> REPLACE',
    ].join('\n');

    parser.parse(stream);

    expect(onPatch).toHaveBeenCalledTimes(2);
    expect(onPatch).toHaveBeenNthCalledWith(1, 'index.html', 'block 1 old', 'block 1 new');
    expect(onPatch).toHaveBeenNthCalledWith(2, 'index.html', 'block 2 old', 'block 2 new');
  });
});
