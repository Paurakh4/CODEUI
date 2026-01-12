import { describe, it, expect } from 'vitest';
// @ts-ignore - Module does not exist yet
import { estimateTokenCount } from '../../../lib/token-counter';

describe('estimateTokenCount', () => {
  it('should return 0 for empty string', () => {
    expect(estimateTokenCount('')).toBe(0);
  });

  it('should estimate tokens correctly (rough approximation)', () => {
    // 1 token ~= 4 chars
    const text = 'hello world'; // 11 chars -> ~2-3 tokens
    const count = estimateTokenCount(text);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });
  
  it('should handle large text', () => {
    const text = 'a'.repeat(4000); // ~1000 tokens
    const count = estimateTokenCount(text);
    expect(count).toBeGreaterThan(800);
    expect(count).toBeLessThan(1200);
  });
});
