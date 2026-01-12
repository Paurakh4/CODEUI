import { describe, it, expect } from 'vitest';
// @ts-ignore - Module does not exist yet
import { buildContext, ContextInput } from '../../lib/context-builder';

describe('buildContext', () => {
  it('should include the current file content', () => {
    const input: ContextInput = {
      currentFile: { name: 'index.html', content: '<html>...</html>' },
    };
    const context = buildContext(input);
    expect(context).toContain('Current file: index.html');
    expect(context).toContain('<html>...</html>');
  });

  it('should include selected element if provided', () => {
    const input: ContextInput = {
      currentFile: { name: 'index.html', content: '<html><body><button>Click</button></body></html>' },
      selectedElement: '<button>Click</button>',
    };
    const context = buildContext(input);
    expect(context).toContain('Update ONLY this element:');
    expect(context).toContain('<button>Click</button>');
  });

  it('should include other files if provided', () => {
    const input: ContextInput = {
      currentFile: { name: 'index.html', content: '...' },
      otherFiles: [
        { name: 'style.css', content: 'body { color: red; }' }
      ]
    };
    const context = buildContext(input);
    expect(context).toContain('style.css');
    expect(context).toContain('body { color: red; }');
  });
  
  it('should truncate context if it exceeds token limit (mocked)', () => {
      // This test might depend on token counter logic, but we can test basic structure first
      // or verify it calls estimateTokenCount
  });
});
