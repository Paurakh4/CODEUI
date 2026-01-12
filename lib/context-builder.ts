import { estimateTokenCount } from './token-counter';

export interface ContextInput {
  currentFile: {
    name: string;
    content: string;
  };
  otherFiles?: {
    name: string;
    content: string;
  }[];
  selectedElement?: string; // HTML string of the selected element
  maxTokens?: number;
}

const DEFAULT_MAX_TOKENS = 12000; // Safe buffer for 16k models

export function buildContext(input: ContextInput): string {
  const { currentFile, otherFiles = [], selectedElement, maxTokens = DEFAULT_MAX_TOKENS } = input;
  
  let context = "";
  let currentTokens = 0;

  // Priority 3: Selected Element (Highest Priority for immediate context)
  // We prepend this or make it very visible.
  if (selectedElement) {
    const elementContext = `

Update ONLY this element:
${selectedElement}
`;
    context += elementContext;
    currentTokens += estimateTokenCount(elementContext);
  }

  // Priority 1: Current File
  const currentFileContext = `
Current file: ${currentFile.name}
${currentFile.content}
`;
  const currentFileTokens = estimateTokenCount(currentFileContext);
  
  if (currentTokens + currentFileTokens <= maxTokens) {
    context = currentFileContext + context; // Prepend file context
    currentTokens += currentFileTokens;
  } else {
    // Truncate current file if strictly necessary (though this is bad)
    // For now, we assume current file fits or we just send it and hope.
    // Ideally we might truncate the middle.
    context = currentFileContext + context;
    currentTokens += currentFileTokens;
  }

  // Priority 2: Other Files
  for (const file of otherFiles) {
    const fileHeader = `
File: ${file.name}
`;
    const fileContent = file.content;
    const fileTokens = estimateTokenCount(fileHeader + fileContent);

    if (currentTokens + fileTokens <= maxTokens) {
      context += `${fileHeader}${fileContent}
`;
      currentTokens += fileTokens;
    } else {
        // If we can't fit the whole file, maybe we just add the name?
        // Or stop adding files.
        break; 
    }
  }

  return context;
}
