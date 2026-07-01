# Implementation Plan

- [x] 1. Set up project structure and core types
  - [x] 1.1 Create directory structure for components, engine, state, and utils
    - Set up folders: `src/components/CanvasOverlay/`, `src/components/PropertyInspector/`, `src/components/HierarchyNavigator/`
    - Set up folders: `src/engine/`, `src/state/`, `src/utils/`, `src/types/`
    - _Requirements: All_

  - [ ] 1.2 Define TypeScript interfaces and types
    - Create `src/types/index.ts` with all interfaces: ParsedStyles, StyleChanges, BoxSpacing, BoxModel, TransformValues, FilterValues, SerializedStyleData
    - Define InspectorMode ('edit' | 'prompt' | 'code'), Breakpoint ('auto' | 'sm' | 'lg'), Position types
    - Define BoundingBoxStyle, AncestorNode, CanvasOverlayProps, PropertyInspectorProps interfaces
    - _Requirements: All_

- [ ] 2. Implement Style Engine core
  - [ ] 2.1 Implement style parsing functions
    - Create `src/engine/StyleEngine.ts`
    - Implement `parseStyles(element: HTMLElement): ParsedStyles` to extract Tailwind classes from className
    - Parse inline styles from style attribute into key-value pairs
    - Parse computed box model (margin, padding) values
    - Parse transform values (translate, skew, rotate, scale, 3D rotations, perspective)
    - Parse filter values (grayscale, invert)
    - _Requirements: 7.2, 7.4, 8.3, 9.3, 10.5, 11.3_

  - [ ] 2.2 Implement style application functions
    - Implement `applyStyles(element: HTMLElement, styles: StyleChanges): void`
    - Apply Tailwind classes by updating element.className
    - Apply inline styles by updating element.style properties
    - Apply box model values (margin-top, margin-right, etc., padding-top, etc.)
    - Apply transform values by building CSS transform string
    - Apply filter values by building CSS filter string
    - _Requirements: 7.2, 7.4, 8.3, 9.3, 10.5, 11.3_

  - [ ] 2.3 Implement CSS validation
    - Create `validateTailwindClasses(input: string): { valid: boolean; errors: string[] }`
    - Create `validateInlineCSS(input: string): { valid: boolean; errors: string[] }`
    - Validate class name format (alphanumeric, hyphens, colons for variants)
    - Validate CSS property-value syntax
    - Return specific error messages for invalid input
    - _Requirements: 7.5_

  - [ ] 2.4 Implement transform string builders
    - Create `buildTransform2D(values: TransformValues): string` for translate, skew, rotate, scale
    - Create `buildTransform3D(values: TransformValues): string` for rotateX, rotateY, rotateZ
    - Create `buildPerspective(value: number): string`
    - Handle unit conversions (px, %, deg)
    - _Requirements: 10.5, 11.3_

  - [ ] 2.5 Implement filter string builder
    - Create `buildFilterString(values: FilterValues): string`
    - Handle grayscale(%), invert(%)
    - Handle alpha mask gradient generation with angle
    - _Requirements: 9.3_

- [ ] 3. Implement serialization utilities
  - [ ] 3.1 Implement serialize and deserialize functions
    - Create `src/utils/serialization.ts`
    - Implement `serializeStyles(styles: ParsedStyles): string` producing valid JSON
    - Implement `deserializeStyles(data: string): ParsedStyles` with error handling
    - Include version field for future migrations
    - Handle undefined/null values gracefully
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 3.2 Implement element selector generation
    - Create `generateSelector(element: HTMLElement): string` for unique element identification
    - Use id if available, otherwise generate path-based selector
    - Handle edge cases (no id, duplicate classes)
    - _Requirements: 14.1_

- [ ] 4. Implement Selection State management
  - [ ] 4.1 Create selection state store
    - Create `src/state/selectionState.ts` using React Context or Zustand
    - Define state: `{ selectedElement: HTMLElement | null, hoveredElement: HTMLElement | null }`
    - Implement `selectElement(element: HTMLElement | null): void`
    - Implement `hoverElement(element: HTMLElement | null): void`
    - Implement `clearSelection(): void`
    - _Requirements: 1.2, 1.4_

  - [ ] 4.2 Implement element ancestry utilities
    - Create `getAncestry(element: HTMLElement): AncestorNode[]`
    - Walk up DOM tree from element to document.body
    - Return array with tagName, id, className for each ancestor
    - Handle edge cases (detached elements, shadow DOM)
    - _Requirements: 5.1, 5.2_

  - [ ] 4.3 Implement bounding box calculation
    - Create `getBoundingBox(element: HTMLElement): BoundingBoxStyle`
    - Use getBoundingClientRect() for accurate positioning
    - Account for scroll position and iframe offset if applicable
    - Return top, left, width, height, visible properties
    - _Requirements: 1.1_

- [ ] 5. Implement Canvas Overlay component
  - [ ] 5.1 Create CanvasOverlay component
    - Create `src/components/CanvasOverlay/CanvasOverlay.tsx`
    - Render transparent overlay div covering the canvas area
    - Implement mousemove handler to detect hovered element using document.elementFromPoint()
    - Render bounding box highlight for hovered element
    - Render selection indicator for selected element (different style)
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 5.2 Implement click handling for selection
    - Add click handler to overlay
    - Prevent default and stop propagation to avoid triggering element actions
    - Call selectElement with clicked element
    - _Requirements: 1.2_

  - [ ] 5.3 Implement deselection handling
    - Handle click on overlay background (no element) to deselect
    - Add keydown listener for Escape key to deselect
    - Clean up event listeners on unmount
    - _Requirements: 1.4_

  - [ ] 5.4 Implement hover highlight rendering
    - Create `BoundingBoxHighlight` sub-component
    - Position absolutely based on bounding box coordinates
    - Style with border, semi-transparent background
    - Animate transitions for smooth UX
    - _Requirements: 1.1_

- [ ] 6. Implement Property Inspector panel
  - [ ] 6.1 Create PropertyInspector shell component
    - Create `src/components/PropertyInspector/PropertyInspector.tsx`
    - Render floating panel with dark theme styling
    - Implement header with element tag name display (uppercase)
    - Add mode tabs: EDIT (default), PROMPT, CODE
    - Add window controls: copy, paste, more options (...), close (X)
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4, 2.4_

  - [ ] 6.2 Implement panel positioning logic
    - Create `calculatePanelPosition(elementRect: DOMRect, panelSize: { width: number, height: number }, viewport: { width: number, height: number }): Position`
    - Position panel to right of element if space available
    - Fall back to left, above, or below if needed
    - Ensure panel stays within viewport bounds
    - _Requirements: 2.1_

  - [ ] 6.3 Implement panel dragging
    - Add drag handle to panel header (cursor: move)
    - Track mousedown, mousemove, mouseup for drag operation
    - Update panel position state during drag
    - Constrain to viewport boundaries
    - _Requirements: 2.3_

  - [ ] 6.4 Implement mode switching
    - Create state for activeMode: InspectorMode
    - Render EDIT mode content by default
    - Render PROMPT mode with AI chat interface placeholder
    - Render CODE mode with code editor placeholder (Monaco integration point)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 7. Implement Property Inspector EDIT mode sections
  - [ ] 7.1 Implement HierarchyNavigator breadcrumbs
    - Create `src/components/HierarchyNavigator/HierarchyNavigator.tsx`
    - Display horizontal breadcrumb list: `div > p > span`
    - Style each breadcrumb as clickable chip
    - Handle click to select ancestor element
    - Highlight current element in breadcrumbs
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 7.2 Implement Content & Attributes section
    - Create collapsible section "Content & Attributes"
    - Add Link input field for href (show only for applicable elements)
    - Add Text Content textarea for innerText editing
    - Add Element ID input field
    - Wire inputs to update element in real-time
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 7.3 Implement placeholder highlighting in text content
    - Detect `{identifier}` patterns in text content
    - Render highlighted spans for placeholders in preview
    - Allow editing while preserving placeholder syntax
    - _Requirements: 6.5_

  - [ ] 7.4 Implement Tailwind Classes section
    - Create collapsible section "Tailwind Classes"
    - Add text input for class string
    - Show validation errors inline
    - Apply classes on blur or Enter key
    - _Requirements: 7.1, 7.2, 7.5_

  - [ ] 7.5 Implement Inline CSS section
    - Create collapsible section "Inline CSS"
    - Add textarea for CSS properties
    - Show validation errors inline
    - Apply styles on blur or Enter key
    - _Requirements: 7.3, 7.4, 7.5_

- [ ] 8. Implement visual styling controls
  - [ ] 8.1 Implement Box Model spacing controls
    - Create `BoxModelControl` component
    - Render visual box model diagram with margin (outer) and padding (inner) areas
    - Add numeric inputs for top, right, bottom, left for both margin and padding
    - Add unit selector dropdown (px, rem, em, %)
    - Wire to StyleEngine.applyStyles on value change
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 8.2 Implement Effects controls
    - Create `EffectsControl` component
    - Add Grayscale toggle switch with slider (0-100%)
    - Add Invert toggle switch with slider (0-100%)
    - Add Alpha Mask slider (0-100%)
    - Add Mask Angle slider (0-360°) with circular input option
    - Wire to StyleEngine.applyStyles on value change
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 8.3 Implement 2D Transform controls
    - Create `Transform2DControl` component
    - Add Translate X input with unit toggle (px/%)
    - Add Translate Y input with unit toggle (px/%)
    - Add Skew X input (degrees)
    - Add Skew Y input (degrees)
    - Add Rotate input (degrees) with circular slider option
    - Add Scale input (percentage, default 100%)
    - Wire to StyleEngine.applyStyles on value change
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 8.4 Implement 3D Transform controls
    - Create `Transform3DControl` component
    - Add Rotate X input (degrees)
    - Add Rotate Y input (degrees)
    - Add Rotate Z input (degrees)
    - Add Perspective input (pixels)
    - Wire to StyleEngine.applyStyles on value change
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 8.5 Implement slider and input components
    - Create reusable `Slider` component with track, thumb, value display
    - Create reusable `NumericInput` component with increment/decrement buttons
    - Create reusable `Toggle` switch component
    - Style consistently with dark theme
    - _Requirements: 8.1, 8.2, 9.1, 9.2, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2_

- [ ] 9. Implement Breakpoint Manager
  - [ ] 9.1 Create BreakpointManager state
    - Create `src/state/breakpointState.ts`
    - Define state: `{ activeBreakpoint: Breakpoint }`
    - Implement `setBreakpoint(breakpoint: Breakpoint): void`
    - Default to 'auto'
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 9.2 Implement breakpoint toggle UI
    - Create `BreakpointToggle` component
    - Render toggle buttons: AUTO, *, SM, LG
    - Highlight active breakpoint
    - Show "Auto Breakpoint" indicator when applicable
    - _Requirements: 4.1, 4.4_

  - [ ] 9.3 Integrate breakpoint with style application
    - Modify StyleEngine to accept breakpoint parameter
    - Prefix Tailwind classes with `sm:` or `lg:` based on breakpoint
    - Apply inline styles conditionally (may require CSS custom properties or media query injection)
    - _Requirements: 4.2_

- [ ] 10. Implement Style Clipboard
  - [ ] 10.1 Create StyleClipboard utility
    - Create `src/utils/clipboard.ts`
    - Implement `copy(styles: ParsedStyles): void` to store in module-level variable
    - Implement `paste(): ParsedStyles | null` to retrieve stored styles
    - Implement `hasContent(): boolean` to check if clipboard has data
    - Implement `clear(): void` to reset clipboard
    - _Requirements: 13.1, 13.2, 13.4_

  - [ ] 10.2 Implement style merge logic
    - Create `mergeStyles(existing: ParsedStyles, pasted: ParsedStyles): ParsedStyles`
    - Pasted Tailwind classes append to existing (or replace conflicting utilities)
    - Pasted inline styles override existing properties with same key
    - Pasted transforms override existing transform values
    - Pasted filters override existing filter values
    - _Requirements: 13.3_

  - [ ] 10.3 Add copy/paste buttons to Property Inspector
    - Add copy icon button in header that calls clipboard.copy with current element styles
    - Add paste icon button that calls clipboard.paste and applies merged styles
    - Disable paste button when clipboard.hasContent() is false
    - Show toast notification on copy/paste success
    - _Requirements: 13.1, 13.2, 13.4_

- [ ] 11. Implement error handling and recovery
  - [ ] 11.1 Implement error recovery in StyleEngine
    - Wrap applyStyles in try-catch
    - Store previous state before applying changes
    - Revert to previous state on error
    - Return `{ success: boolean, error?: string }` from applyStyles
    - _Requirements: 12.3_

  - [ ] 11.2 Add error display to Property Inspector
    - Create `ValidationError` component for inline error display
    - Show red border and error message below invalid inputs
    - Create `Toast` component for transient notifications
    - Show toast for critical errors (DOM mutation failed, etc.)
    - _Requirements: 7.5, 12.3_

  - [ ] 11.3 Handle element removal during editing
    - Add MutationObserver to detect when selected element is removed from DOM
    - Clear selection and close Property Inspector if element is removed
    - Show toast notification explaining what happened
    - _Requirements: 12.3_

- [ ] 12. Implement real-time update optimization
  - [ ] 12.1 Implement debounced style application
    - Create `useDebouncedCallback` hook
    - Debounce style application for text inputs (300ms)
    - Apply immediately for sliders and toggles
    - _Requirements: 12.1, 12.2_

  - [ ] 12.2 Implement batched updates
    - Create update queue for rapid successive changes
    - Batch multiple property changes into single DOM update
    - Use requestAnimationFrame for smooth rendering
    - _Requirements: 12.2_

- [ ] 13. Implement persistence integration
  - [ ] 13.1 Create persistence service
    - Create `src/utils/persistence.ts`
    - Implement `saveStyleChanges(projectId: string, changes: SerializedStyleData[]): Promise<void>`
    - Implement `loadStyleChanges(projectId: string): Promise<SerializedStyleData[]>`
    - Integrate with project save mechanism (localStorage for dev, API for production)
    - _Requirements: 14.1, 14.2_

  - [ ] 13.2 Implement auto-save on style change
    - Subscribe to style changes in StyleEngine
    - Serialize and queue changes for persistence
    - Debounce save operations (1 second)
    - _Requirements: 14.1_

  - [ ] 13.3 Implement style restoration on project load
    - Load serialized styles when project opens
    - Deserialize and apply styles to matching elements
    - Handle missing elements gracefully (element selector no longer matches)
    - _Requirements: 14.2_

- [ ] 14. Integrate with main application
  - [ ] 14.1 Create VisualDesignStudio container component
    - Create `src/components/VisualDesignStudio/VisualDesignStudio.tsx`
    - Compose CanvasOverlay, PropertyInspector, and state providers
    - Accept canvas iframe/element reference as prop
    - Expose enable/disable API for mode switching
    - _Requirements: All_

  - [ ] 14.2 Integrate with top navigation Design mode
    - Wire Design mode button to enable VisualDesignStudio
    - Wire Preview/Code mode buttons to disable VisualDesignStudio
    - Ensure clean state transitions between modes
    - _Requirements: All_

  - [ ] 14.3 Integrate with viewport controls
    - Sync canvas viewport size with Desktop/Tablet/Mobile toggles
    - Update bounding box calculations when viewport changes
    - Maintain selection across viewport changes
    - _Requirements: All_

- [ ] 15. Polish and production readiness
  - [ ] 15.1 Implement keyboard shortcuts
    - Escape: deselect element
    - Cmd/Ctrl+C: copy styles (when element selected)
    - Cmd/Ctrl+V: paste styles (when element selected)
    - Arrow keys: nudge selected element position
    - _Requirements: 1.4, 13.1, 13.2_

  - [ ] 15.2 Implement accessibility
    - Add ARIA labels to all interactive elements
    - Ensure keyboard navigation through Property Inspector
    - Add focus indicators
    - Support screen reader announcements for selection changes
    - _Requirements: All_

  - [ ] 15.3 Implement responsive Property Inspector
    - Collapse sections by default on small viewports
    - Adjust panel size based on available space
    - Support docked mode as alternative to floating
    - _Requirements: 2.1_

  - [ ] 15.4 Add loading and empty states
    - Show loading indicator while parsing styles
    - Show empty state message when no element selected
    - Show placeholder content for PROMPT and CODE modes
    - _Requirements: All_
