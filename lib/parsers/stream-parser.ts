import { escapeRegExp } from '../utils/regex-helper';
import {
  SEARCH_START,
  DIVIDER,
  REPLACE_END,
  UPDATE_FILE_START,
  UPDATE_FILE_END,
} from '../constants';

export interface StreamParserOptions {
  onFileUpdate?: (filePath: string) => void;
  onPatch?: (filePath: string, searchBlock: string, replaceBlock: string) => void;
}

export class StreamParser {
  private currentFilePath: string | null = null;
  private options: StreamParserOptions;
  private processedPatches = new Set<string>();

  constructor(options: StreamParserOptions) {
    this.options = options;
  }

  /**
   * Parses a full or partial stream string.
   */
  public parse(content: string): void {
    const escUpdateStart = escapeRegExp(UPDATE_FILE_START);
    const escUpdateEnd = escapeRegExp(UPDATE_FILE_END);
    const escSearchStart = escapeRegExp(SEARCH_START);
    const escDivider = escapeRegExp(DIVIDER);
    const escReplaceEnd = escapeRegExp(REPLACE_END);

    // 1. Detect File Updates
    const fileUpdateRegex = new RegExp(`${escUpdateStart}\\s*(\\S+)\\s*${escUpdateEnd}`, 'g');
    let fileMatch;
    
    while ((fileMatch = fileUpdateRegex.exec(content)) !== null) {
      const filePath = fileMatch[1].trim();
      if (this.currentFilePath !== filePath) {
        this.currentFilePath = filePath;
        this.options.onFileUpdate?.(filePath);
      }
    }

    // 2. Detect Search/Replace Blocks
    const patchRegex = new RegExp(`${escSearchStart}\\s*([\\s\\S]*?)${escDivider}\\s*([\\s\\S]*?)${escReplaceEnd}`, 'g');
    let patchMatch;

    while ((patchMatch = patchRegex.exec(content)) !== null) {
      const searchBlock = patchMatch[1].trim();
      const replaceBlock = patchMatch[2].trim();
      
      // Use a simple hash or stringified content to avoid re-processing the same patch
      // in the same stream (since parse might be called with accumulated content)
      const patchId = `${this.currentFilePath}:${patchMatch.index}`;
      
      if (this.currentFilePath && !this.processedPatches.has(patchId)) {
        this.options.onPatch?.(this.currentFilePath, searchBlock, replaceBlock);
        this.processedPatches.add(patchId);
      }
    }
  }

  public reset(): void {
    this.currentFilePath = null;
    this.processedPatches.clear();
  }
}