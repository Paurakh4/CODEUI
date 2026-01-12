# Implementation Plan - Reprompting & Partial UI Updates

## Phase 1: Core Protocol & Backend Setup
- [x] Task: Define Protocol Constants [ac059c5]
    - [ ] Create `lib/constants.ts` (or update existing) with `SEARCH_START`, `DIVIDER`, `REPLACE_END`, etc.
- [x] Task: Implement Context Construction Logic [36fd44a]
    - [ ] Create `lib/utils/token-counter.ts`:
        - [ ] Implement `estimateTokenCount` helper to manage context limits.
    - [ ] Create/Update `lib/context-builder.ts`:
        - [ ] Implement logic to gather content of open files (Priority 1).
        - [ ] Implement logic to find and include related files (Priority 2).
        - [ ] Implement logic to inject selected element HTML (Priority 3).
        - [ ] Implement token-aware truncation/summarization (Priority 4) using `estimateTokenCount`.
- [x] Task: Create System Prompts [7964d07]
    - [ ] Create `lib/prompts/reprompt-system.ts`:
        - [ ] Define the `FOLLOW_UP_SYSTEM_PROMPT` emphasizing the `SEARCH`/`REPLACE` protocol.
        - [ ] Add specific instructions for Deletions (empty replace block).
        - [ ] Add Web Component awareness instructions.
- [ ] Task: Conductor - User Manual Verification 'Core Protocol & Backend Setup' (Protocol in workflow.md)

## Phase 2: Frontend Parsing & State Management
- [ ] Task: Implement Flexible Regex Helper
    - [ ] Create `lib/utils/regex-helper.ts`:
        - [ ] Implement `escapeRegExp`.
        - [ ] Implement `createFlexibleHtmlRegex` to handle whitespace/newline variations.
        - [ ] Add unit tests for `createFlexibleHtmlRegex` with various edge cases.
        - [ ] **Verification:** Add a "Test Suite of Common AI Hallucinations" (extra spaces, missing tags) to validate robustness.
- [ ] Task: Implement Streaming Parser Logic
    - [ ] Create `lib/parsers/stream-parser.ts`:
        - [ ] Implement a class/function to buffer the stream.
        - [ ] Detect `UPDATE_FILE_START` to switch context.
        - [ ] Accumulate `SEARCH` block content.
        - [ ] Upon `DIVIDER`, lock the `SEARCH` target.
        - [ ] Accumulate `REPLACE` block content.
        - [ ] On `REPLACE_END`, trigger the patch application.
- [ ] Task: Integrate State Locking
    - [ ] Update `stores/editor-store.tsx` (or equivalent):
        - [ ] Add `isApplyingPatch` state.
        - [ ] Update Editor component to be `read-only` when `isApplyingPatch` is true.
- [ ] Task: Conductor - User Manual Verification 'Frontend Parsing & State Management' (Protocol in workflow.md)

## Phase 3: Patch Application & Fallback Mechanism
- [ ] Task: Implement Patch Application Logic
    - [ ] In `lib/parsers/stream-parser.ts` (or `hooks/use-ai-chat.ts`):
        - [ ] Use `createFlexibleHtmlRegex` to find the match in the current file content.
        - [ ] Apply the replacement.
        - [ ] Handle "Deletion" cases (empty replace block).
        - [ ] Return a success/failure status.
- [ ] Task: Implement Fallback Logic
    - [ ] Update `app/api/ai/route.ts` (or where the AI response is handled) / `hooks/use-ai-chat.ts`:
        - [ ] Monitor the parser's success status.
        - [ ] If a patch fails:
            - [ ] Abort the current stream.
            - [ ] Trigger a "Retrying with full context..." toast/notification.
            - [ ] Trigger a new, separate API call requesting the **FULL** file content for the failed file.
- [ ] Task: Conductor - User Manual Verification 'Patch Application & Fallback Mechanism' (Protocol in workflow.md)

## Phase 4: Integration & Verification
- [ ] Task: Connect Frontend to Backend
    - [ ] Update `hooks/use-ai-chat.ts` to use the new `reprompt-system` prompt for follow-up messages.
    - [ ] Pass the constructed "Smart Context" in the API request body.
- [ ] Task: Conductor - User Manual Verification 'Integration & Verification' (Protocol in workflow.md)
