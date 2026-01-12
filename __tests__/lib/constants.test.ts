import { describe, it, expect } from 'vitest';
// @ts-ignore - The module does not exist yet
import {
  SEARCH_START,
  DIVIDER,
  REPLACE_END,
  UPDATE_FILE_START,
  UPDATE_FILE_END,
  PROJECT_NAME_START,
  PROJECT_NAME_END,
  NEW_FILE_START,
  NEW_FILE_END
} from '../../lib/constants';

describe('Protocol Constants', () => {
  it('should have the correct values for reprompting protocol', () => {
    expect(SEARCH_START).toBe('<<<<<<< SEARCH');
    expect(DIVIDER).toBe('=======');
    expect(REPLACE_END).toBe('>>>>>>> REPLACE');
    expect(UPDATE_FILE_START).toBe('<<<<<<< UPDATE_FILE_START');
    expect(UPDATE_FILE_END).toBe('>>>>>>> UPDATE_FILE_END');
  });

  it('should have the correct values for other protocol markers', () => {
    expect(PROJECT_NAME_START).toBe('<<<<<<< PROJECT_NAME_START');
    expect(PROJECT_NAME_END).toBe('>>>>>>> PROJECT_NAME_END');
    expect(NEW_FILE_START).toBe('<<<<<<< NEW_FILE_START');
    expect(NEW_FILE_END).toBe('>>>>>>> NEW_FILE_END');
  });
});
