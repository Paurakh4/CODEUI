import { createFlexibleHtmlRegex, escapeRegExp } from '../utils/regex-helper';
import { createRepromptLogger } from '../utils/reprompt-logger';
import {
  SEARCH_START,
  DIVIDER,
  REPLACE_END,
  UPDATE_FILE_START,
  UPDATE_FILE_END,
  PROJECT_NAME_START,
  PROJECT_NAME_END,
  NEW_FILE_START,
  NEW_FILE_END,
} from '../constants';

export interface PatchResult {
  success: boolean;
  content: string;
  error?: string;
  tier?: 'prepend' | 'exact' | 'trimmed' | 'collapsed-whitespace' | 'line-normalized' | 'flexible-regex';
}

export interface StreamParserOptions {
  onFileUpdate?: (filePath: string) => void;
  onPatch?: (filePath: string, searchBlock: string, replaceBlock: string) => void;
  onProjectNameUpdate?: (name: string) => void;
  onNewFile?: (filePath: string, content: string) => void;
  onIncompletePatch?: (count: number) => void;
}

export interface AIResponseValidationResult {
  valid: boolean;
  reason?: string;
}

const logger = createRepromptLogger('stream-parser');

export function detectIncompletePatchBlocks(content: string): number {
  const searchMatches = content.match(new RegExp(escapeRegExp(SEARCH_START), 'g'))?.length ?? 0;
  const replaceMatches = content.match(new RegExp(escapeRegExp(REPLACE_END), 'g'))?.length ?? 0;
  return Math.max(0, searchMatches - replaceMatches);
}

export function validateAIResponse(content: string): AIResponseValidationResult {
  const trimmed = content.trim();

  if (!trimmed) {
    return { valid: false, reason: 'Empty AI response' };
  }

  const hasPatchMarkers =
    trimmed.includes(SEARCH_START) ||
    trimmed.includes(UPDATE_FILE_START) ||
    trimmed.includes(PROJECT_NAME_START) ||
    trimmed.includes(NEW_FILE_START);

  const hasHtmlDocument = /<!DOCTYPE[\s\S]*?<\/html>/i.test(trimmed) || /<html[\s\S]*?<\/html>/i.test(trimmed);
  const hasHtmlCodeFence = /```html?\s*[\s\S]*?```/i.test(trimmed);
  const looksLikeRefusal = /\b(i\s+(can('|’)t|cannot)|i\s+apologize|sorry)\b/i.test(trimmed);
  const looksLikeNarration = /\b(here('|’)s|here is|i updated|the changes|i made|explanation|what i changed)\b/i.test(trimmed);

  if (looksLikeRefusal && !hasPatchMarkers && !hasHtmlDocument) {
    return { valid: false, reason: 'Model refused or did not provide an actionable response' };
  }

  if (looksLikeNarration && !hasPatchMarkers && !hasHtmlDocument && !hasHtmlCodeFence) {
    return { valid: false, reason: 'AI response contained narration without actionable HTML or patches' };
  }

  return { valid: true };
}

export class StreamParser {
  private currentFilePath: string | null = null;
  private options: StreamParserOptions;
  private processedPatches = new Set<string>();
  private processedProjectNames = new Set<string>();
  private processedNewFiles = new Set<string>();
  private lastIncompletePatchCount = 0;

  constructor(options: StreamParserOptions) {
    this.options = options;
  }

  private normalizeLineEndings(content: string): string {
    return content.replace(/\r\n/g, '\n');
  }

  private stripCodeFences(content: string): string {
    const fencedMatch = content
      .trim()
      .match(/^```(?:html|css|js|javascript|typescript)?\s*([\s\S]*?)\s*```$/i);

    if (!fencedMatch) {
      return content;
    }

    return fencedMatch[1];
  }

  private trimMarkerPadding(block: string): string {
    return block.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
  }

  private replaceByIndex(content: string, start: number, searchLength: number, replaceBlock: string): string {
    return `${content.slice(0, start)}${replaceBlock}${content.slice(start + searchLength)}`;
  }

  private indentationScore(line: string): number {
    return line.match(/^\s*/)?.[0].length ?? 0;
  }

  private matchLineEndingStyle(currentContent: string, replaceBlock: string): string {
    if (currentContent.includes('\r\n')) {
      return replaceBlock.replace(/\r?\n/g, '\r\n');
    }

    return replaceBlock.replace(/\r\n/g, '\n');
  }

  private applyCollapsedWhitespacePatch(
    currentContent: string,
    searchBlock: string,
    replaceBlock: string,
  ): string | null {
    const normalizedSearch = searchBlock.trim();
    if (!normalizedSearch) {
      return null;
    }

    const tokens = normalizedSearch.split(/\s+/).filter(Boolean).map((token) => escapeRegExp(token));
    if (tokens.length === 0) {
      return null;
    }

    const regex = new RegExp(tokens.join('\\s+'), 'sg');
    const matches = Array.from(currentContent.matchAll(regex));
    if (matches.length !== 1) {
      return null;
    }

    const match = matches[0];
    if (typeof match.index !== 'number') {
      return null;
    }

    return this.replaceByIndex(currentContent, match.index, match[0].length, replaceBlock);
  }

  private applyLineNormalizedPatch(
    currentContent: string,
    searchBlock: string,
    replaceBlock: string,
  ): string | null {
    const normalizedCurrent = this.normalizeLineEndings(currentContent);
    const normalizedSearch = this.normalizeLineEndings(searchBlock);
    const normalizedReplace = this.normalizeLineEndings(replaceBlock);

    const currentLines = normalizedCurrent.split('\n');
    const searchLines = normalizedSearch.split('\n');

    if (searchLines.length === 0 || searchLines.length > currentLines.length) {
      return null;
    }

    const normalizeComparable = (line: string): string => line.trim().replace(/\s+/g, ' ');
    const matchingStarts: Array<{ startIndex: number; score: number }> = [];

    for (let startIndex = 0; startIndex <= currentLines.length - searchLines.length; startIndex += 1) {
      let isMatch = true;
      let score = 0;

      for (let offset = 0; offset < searchLines.length; offset += 1) {
        if (normalizeComparable(currentLines[startIndex + offset]) !== normalizeComparable(searchLines[offset])) {
          isMatch = false;
          break;
        }

        score += Math.abs(
          this.indentationScore(currentLines[startIndex + offset]) - this.indentationScore(searchLines[offset]),
        );
      }

      if (isMatch) {
        matchingStarts.push({ startIndex, score });
      }
    }

    if (matchingStarts.length === 0) {
      return null;
    }

    matchingStarts.sort((left, right) => left.score - right.score);
    const bestMatch = matchingStarts[0];
    if (matchingStarts.length > 1 && matchingStarts[1].score === bestMatch.score) {
      return null;
    }

    const replaceLines = normalizedReplace === '' ? [] : normalizedReplace.split('\n');
    const merged = [
      ...currentLines.slice(0, bestMatch.startIndex),
      ...replaceLines,
      ...currentLines.slice(bestMatch.startIndex + searchLines.length),
    ].join('\n');

    if (currentContent.includes('\r\n')) {
      return merged.replace(/\n/g, '\r\n');
    }

    return merged;
  }

  public applyPatch(currentContent: string, searchBlock: string, replaceBlock: string, filePath?: string | null): PatchResult {
    const normalizedSearchBlock = this.stripCodeFences(searchBlock);
    const normalizedReplaceBlock = this.matchLineEndingStyle(
      currentContent,
      this.stripCodeFences(replaceBlock),
    );
    const fileInfo = filePath || this.currentFilePath || 'unknown file';

    logger.debug('Attempting patch application', {
      phase: 'apply',
      filePath: fileInfo,
      searchLength: normalizedSearchBlock.length,
      replaceLength: normalizedReplaceBlock.length,
    });

    if (normalizedSearchBlock.trim() === '') {
      const prefix = normalizedReplaceBlock === '' ? '' : `${normalizedReplaceBlock}\n`;
      return {
        success: true,
        content: `${prefix}${currentContent}`,
        tier: 'prepend',
      };
    }

    const exactIndex = currentContent.indexOf(normalizedSearchBlock);
    if (exactIndex !== -1) {
      return {
        success: true,
        content: this.replaceByIndex(currentContent, exactIndex, normalizedSearchBlock.length, normalizedReplaceBlock),
        tier: 'exact',
      };
    }

    const trimmedSearch = normalizedSearchBlock.trim();
    if (trimmedSearch !== '' && trimmedSearch !== normalizedSearchBlock) {
      const trimmedIndex = currentContent.indexOf(trimmedSearch);
      if (trimmedIndex !== -1) {
        return {
          success: true,
          content: this.replaceByIndex(currentContent, trimmedIndex, trimmedSearch.length, normalizedReplaceBlock),
          tier: 'trimmed',
        };
      }
    }

    const collapsedWhitespaceResult = this.applyCollapsedWhitespacePatch(
      currentContent,
      normalizedSearchBlock,
      normalizedReplaceBlock,
    );
    if (collapsedWhitespaceResult !== null) {
      return {
        success: true,
        content: collapsedWhitespaceResult,
        tier: 'collapsed-whitespace',
      };
    }

    const lineNormalizedResult = this.applyLineNormalizedPatch(
      currentContent,
      normalizedSearchBlock,
      normalizedReplaceBlock,
    );
    if (lineNormalizedResult !== null) {
      return {
        success: true,
        content: lineNormalizedResult,
        tier: 'line-normalized',
      };
    }

    const regexCandidates = [normalizedSearchBlock, trimmedSearch].filter(Boolean);
    for (const candidate of regexCandidates) {
      try {
        const regex = createFlexibleHtmlRegex(candidate);
        const match = currentContent.match(regex);

        if (!match) {
          continue;
        }

        return {
          success: true,
          content: currentContent.replace(regex, normalizedReplaceBlock),
          tier: 'flexible-regex',
        };
      } catch (error) {
        logger.warn('Flexible regex tier failed', {
          phase: 'match',
          filePath: fileInfo,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.warn('Patch application failed', {
      phase: 'apply',
      filePath: fileInfo,
      searchPreview: normalizedSearchBlock.slice(0, 160),
    });

    return {
      success: false,
      content: currentContent,
      error: `Could not find match for SEARCH block in ${fileInfo}`,
    };
  }

  public parse(content: string): void {
    const escUpdateStart = escapeRegExp(UPDATE_FILE_START);
    const escUpdateEnd = escapeRegExp(UPDATE_FILE_END);
    const escSearchStart = escapeRegExp(SEARCH_START);
    const escDivider = escapeRegExp(DIVIDER);
    const escReplaceEnd = escapeRegExp(REPLACE_END);
    const escProjectStart = escapeRegExp(PROJECT_NAME_START);
    const escProjectEnd = escapeRegExp(PROJECT_NAME_END);
    const escNewFileStart = escapeRegExp(NEW_FILE_START);
    const escNewFileEnd = escapeRegExp(NEW_FILE_END);

    const projectRegex = new RegExp(`${escProjectStart}\\s*([\\s\\S]*?)${escProjectEnd}`, 'g');
    let projectMatch: RegExpExecArray | null;
    while ((projectMatch = projectRegex.exec(content)) !== null) {
      const name = projectMatch[1].trim();
      if (!this.processedProjectNames.has(name)) {
        this.options.onProjectNameUpdate?.(name);
        this.processedProjectNames.add(name);
      }
    }

    const fileUpdateRegex = new RegExp(`${escUpdateStart}\\s*(\\S+)\\s*${escUpdateEnd}`, 'g');
    let fileMatch: RegExpExecArray | null;
    while ((fileMatch = fileUpdateRegex.exec(content)) !== null) {
      const filePath = fileMatch[1].trim();
      if (this.currentFilePath !== filePath) {
        this.currentFilePath = filePath;
        this.options.onFileUpdate?.(filePath);
      }
    }

    const newFileRegex = new RegExp(`${escNewFileStart}\\s*(\\S+)\\s*${escDivider}\\s*([\\s\\S]*?)${escNewFileEnd}`, 'g');
    let newFileMatch: RegExpExecArray | null;
    while ((newFileMatch = newFileRegex.exec(content)) !== null) {
      const filePath = newFileMatch[1].trim();
      const fileContent = newFileMatch[2].trim();
      if (!this.processedNewFiles.has(filePath)) {
        this.options.onNewFile?.(filePath, fileContent);
        this.processedNewFiles.add(filePath);
      }
    }

    const patchRegex = new RegExp(`${escSearchStart}\\s*([\\s\\S]*?)${escDivider}\\s*([\\s\\S]*?)${escReplaceEnd}`, 'g');
    let patchMatch: RegExpExecArray | null;
    while ((patchMatch = patchRegex.exec(content)) !== null) {
      const searchBlock = this.trimMarkerPadding(patchMatch[1]);
      const replaceBlock = this.trimMarkerPadding(patchMatch[2]);
      const patchId = `${this.currentFilePath}:${patchMatch.index}`;

      if (!this.currentFilePath) {
        logger.warn('Skipping patch with no active file context', {
          phase: 'parse',
          patchIndex: patchMatch.index,
        });
        continue;
      }

      if (this.processedPatches.has(patchId)) {
        logger.debug('Skipping already processed patch', {
          phase: 'parse',
          filePath: this.currentFilePath,
          patchIndex: patchMatch.index,
        });
        continue;
      }

      this.options.onPatch?.(this.currentFilePath, searchBlock, replaceBlock);
      this.processedPatches.add(patchId);
    }

    const incompletePatchCount = detectIncompletePatchBlocks(content);
    if (incompletePatchCount !== this.lastIncompletePatchCount) {
      this.lastIncompletePatchCount = incompletePatchCount;
      this.options.onIncompletePatch?.(incompletePatchCount);
    }
  }

  public reset(): void {
    this.currentFilePath = null;
    this.processedPatches.clear();
    this.processedProjectNames.clear();
    this.processedNewFiles.clear();
    this.lastIncompletePatchCount = 0;
  }
}
