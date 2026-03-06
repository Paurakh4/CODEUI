import { describe, it, expect, vi } from 'vitest';

// Mock server-only
vi.mock('server-only', () => ({}));

// @ts-ignore
import { FOLLOW_UP_SYSTEM_PROMPT } from '../../../lib/prompts/reprompt-system';

describe('FOLLOW_UP_SYSTEM_PROMPT', () => {
  it('should exist', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT).toBeDefined();
    expect(typeof FOLLOW_UP_SYSTEM_PROMPT).toBe('string');
  });

  it('should contain mandatory protocol instructions', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('<<<<<<< SEARCH');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('=======');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('>>>>>>> REPLACE');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('<<<<<<< UPDATE_FILE_START');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('>>>>>>> UPDATE_FILE_END');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('<<<<<<< PROJECT_NAME_START');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('>>>>>>> PROJECT_NAME_END');
  });

  it('should contain instructions for deletions', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT.toLowerCase()).toContain('delete');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('leave the REPLACE block empty');
  });

  it('should enforce single-file follow-up updates', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('single HTML file');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('Do NOT create or update any files other than index.html');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('must always be index.html');
  });
  
  it('should instruct to ONLY output changes', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('ONLY the changes');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('Do NOT output the entire file');
  });

  it('should mention conversation history and duplicate patch safety', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('recent conversation history');
    expect(FOLLOW_UP_SYSTEM_PROMPT).toContain('NEVER repeat the same SEARCH/REPLACE block twice');
  });
});
