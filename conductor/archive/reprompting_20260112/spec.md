# Specification: Reprompting & Partial UI Updates

## 1. Overview
This feature enables the AI to make precise, partial updates to the codebase using a "Search/Replace" diffing mechanism. This significantly improves performance and reduces token usage compared to rewriting entire files. The system will use a strict protocol (`SEARCH`/`REPLACE` blocks) and a robust frontend parser to apply these changes to the live state.

## 2. Functional Requirements

### 2.1. Protocol Definition
-   Define strict string constants for the protocol:
    -   `SEARCH_START`: `<<<<<<< SEARCH`
    -   `DIVIDER`: `=======`
    -   `REPLACE_END`: `>>>>>>> REPLACE`
    -   `UPDATE_FILE_START`: `<<<<<<< UPDATE_FILE_START`
    -   `UPDATE_FILE_END`: `>>>>>>> UPDATE_FILE_END`
    -   `PROJECT_NAME_START`/`END` and `NEW_FILE_START`/`END` (as per existing patterns or new requirements).
-   **Deletion Logic:**
    -   If the AI intends to delete code, it must provide the target lines in the `SEARCH` block and leave the area between `DIVIDER` and `REPLACE_END` completely empty.

### 2.2. Backend & System Prompts
-   **Follow-up System Prompt:** Create a specialized system prompt that instructs the AI to **ONLY** output changes using the defined protocol.
    -   Must emphasize: "Do NOT output the entire file."
    -   Must emphasize: "SEARCH block must exactly match the current code."
-   **Web Component Awareness:**
    -   Instruct the AI that when modifying a UI element that is part of a Web Component, it must update the specific `.js` file in the `components/` folder using the same SEARCH/REPLACE protocol to preserve style encapsulation.
-   **Context Injection (Hybrid/Token-Aware):**
    -   **Priority 1:** Full content of the currently open/selected file.
    -   **Priority 2:** Full content of directly related files (e.g., linked CSS/JS).
    -   **Priority 3:** Element-Specific Context (if a UI element is selected, inject its specific HTML).
    -   **Priority 4:** Summaries/Structure of other files if token space permits.

### 2.3. Frontend Processing & Parsing
-   **Streaming Parser:** Implement a parser that processes the AI's streaming response in real-time.
-   **State Locking:**
    -   The code editor must be set to **read-only** mode as soon as the streaming parser begins applying patches to prevent race conditions.
    -   It should return to editable mode only after the stream is closed and the state is synchronized.
-   **Flexible Regex:** Implement a helper function (`createFlexibleHtmlRegex`) to handle whitespace discrepancies between the AI's `SEARCH` block and the actual file content.
    -   Must match varying whitespace and newlines.
-   **Update Logic:**
    -   Identify `UPDATE_FILE_START` blocks to determine the target file.
    -   Extract `SEARCH` and `REPLACE` blocks.
    -   Apply replacements to the current file content using the flexible regex.

### 2.4. Error Handling & Fallback
-   **Detection:** Track successful matches for `SEARCH` blocks.
-   **Fallback:** If a `SEARCH` block fails to match:
    -   **Mechanism:** Abort the current operation.
    -   **Action:** Trigger a new, separate API call requesting the **FULL** file content.
    -   **Feedback:** specific "Retrying with full context..." notification to the user.

## 3. Non-Functional Requirements
-   **Latency:** The parsing and patching process must happen with minimal delay during the stream.
-   **Accuracy:** The Flexible Regex must be permissive enough to handle AI whitespace hallucinations but strict enough to avoid false positives.

## 4. Acceptance Criteria
-   [ ] AI successfully returns `SEARCH`/`REPLACE` blocks for small modification requests.
-   [ ] Frontend correctly parses these blocks and updates the file state in real-time.
-   [ ] Deletions are correctly handled (empty replace block).
-   [ ] Editor enters read-only mode during patch application.
-   [ ] Web Component updates are correctly targeted to their respective files.
-   [ ] Whitespace differences (e.g., extra spaces in tags) do not cause the patch to fail (verified via Flexible Regex).
-   [ ] If the AI returns a bad `SEARCH` block, the system detects the failure, aborts, and retries with a full file request.
-   [ ] Multi-file updates are supported.
