# Requirements Document

## Introduction

The Visual Design Studio is a core feature of DeepSite that provides a "No-Code" / "Low-Code" interface for granular customization of web elements. Users can select any DOM element on a rendered website canvas and modify its properties, styles, and content through a floating Property Inspector panel, enabling visual web development without writing code.

## Glossary

- **Canvas:** The central rendering area displaying the website being edited
- **Property Inspector:** A floating panel that displays and allows editing of the selected element's properties
- **DOM Element:** Any HTML element in the document structure (div, span, h1, button, etc.)
- **Breakpoint:** A screen width threshold used for responsive design (SM, LG, AUTO)
- **Tailwind Classes:** Utility-first CSS class names from the Tailwind CSS framework
- **Box Model:** The CSS concept of margin, padding, border, and content areas around elements
- **Transform:** CSS operations that modify element position, rotation, scale, or skew
- **Bounding Box:** A visual rectangle indicating the boundaries of a selectable element

## Requirements

### Requirement 1: Element Selection and Highlighting

**User Story:** As a designer, I want to select and highlight elements on the canvas, so that I can identify and choose which element to customize.

#### Acceptance Criteria

1. WHEN a user hovers over an element on the canvas THEN the Visual Design Studio SHALL display a bounding box around that element to indicate selectability
2. WHEN a user clicks an element on the canvas THEN the Visual Design Studio SHALL select that element and open the Property Inspector panel
3. WHEN an element is selected THEN the Visual Design Studio SHALL visually distinguish the selected element from unselected elements
4. WHEN a user clicks outside any element or presses Escape THEN the Visual Design Studio SHALL deselect the current element and close the Property Inspector

### Requirement 2: Property Inspector Panel Display

**User Story:** As a designer, I want a floating property panel that shows element details, so that I can view and modify element properties without obscuring my work.

#### Acceptance Criteria

1. WHEN the Property Inspector opens THEN the Visual Design Studio SHALL position the panel to avoid obscuring the selected element
2. WHEN the Property Inspector is displayed THEN the Visual Design Studio SHALL show the tag name of the selected element in the header (e.g., H1, DIV, BUTTON)
3. WHEN the user drags the Property Inspector THEN the Visual Design Studio SHALL allow repositioning of the panel within the viewport
4. WHEN the user clicks the close button THEN the Visual Design Studio SHALL close the Property Inspector and deselect the element

### Requirement 3: Mode Switching

**User Story:** As a designer, I want to switch between Edit, Prompt, and Code modes, so that I can choose the most appropriate way to modify an element.

#### Acceptance Criteria

1. WHEN the Property Inspector opens THEN the Visual Design Studio SHALL display mode tabs for EDIT, PROMPT, and CODE with EDIT as the default
2. WHEN a user clicks the PROMPT tab THEN the Visual Design Studio SHALL display an AI interaction interface for the selected element
3. WHEN a user clicks the CODE tab THEN the Visual Design Studio SHALL display a direct code editor for the selected element
4. WHEN a user clicks the EDIT tab THEN the Visual Design Studio SHALL display visual controls for element properties

### Requirement 4: Responsive Breakpoint Controls

**User Story:** As a designer, I want to apply styles to specific screen sizes, so that I can create responsive designs.

#### Acceptance Criteria

1. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display breakpoint toggle buttons for AUTO, SM, and LG
2. WHEN a user selects a breakpoint THEN the Visual Design Studio SHALL apply subsequent style changes only to that breakpoint
3. WHEN AUTO breakpoint is selected THEN the Visual Design Studio SHALL apply style changes to all screen sizes
4. WHEN a breakpoint-specific style exists THEN the Visual Design Studio SHALL display a visual indicator for that breakpoint

### Requirement 5: Element Hierarchy Navigation

**User Story:** As a designer, I want to navigate the element hierarchy, so that I can quickly select parent elements without clicking on the canvas.

#### Acceptance Criteria

1. WHEN an element is selected THEN the Visual Design Studio SHALL display breadcrumb navigation showing the element ancestry (e.g., div > p > span)
2. WHEN a user clicks a parent element in the breadcrumbs THEN the Visual Design Studio SHALL select that parent element and update the Property Inspector
3. WHEN the element hierarchy changes THEN the Visual Design Studio SHALL update the breadcrumb display to reflect the current structure

### Requirement 6: Content and Attribute Editing

**User Story:** As a designer, I want to edit element content and attributes, so that I can modify text, links, and identifiers visually.

#### Acceptance Criteria

1. WHEN an element contains text content THEN the Visual Design Studio SHALL display a text area for editing the inner text
2. WHEN a user modifies the text content THEN the Visual Design Studio SHALL update the canvas in real-time
3. WHEN an element supports href attribute THEN the Visual Design Studio SHALL display a link input field
4. WHEN a user enters a value in the Element ID field THEN the Visual Design Studio SHALL set the HTML id attribute on the element
5. WHEN text content contains variable placeholders THEN the Visual Design Studio SHALL highlight those placeholders visually (e.g., {span})

### Requirement 7: Tailwind and Inline CSS Editing

**User Story:** As a designer, I want to view and edit raw CSS classes and styles, so that I can make precise styling adjustments at the code level.

#### Acceptance Criteria

1. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display a collapsible Tailwind Classes section
2. WHEN a user edits the Tailwind Classes field THEN the Visual Design Studio SHALL apply the classes to the element and update the canvas
3. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display a collapsible Inline CSS section
4. WHEN a user edits the Inline CSS field THEN the Visual Design Studio SHALL apply the styles to the element and update the canvas
5. WHEN Tailwind classes or inline CSS are modified THEN the Visual Design Studio SHALL validate the input and display parsing errors if invalid

### Requirement 8: Box Model Spacing Controls

**User Story:** As a designer, I want visual controls for margin and padding, so that I can adjust element spacing without writing CSS.

#### Acceptance Criteria

1. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display margin controls for Top, Right, Bottom, and Left
2. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display padding controls for Top, Right, Bottom, and Left
3. WHEN a user adjusts a margin or padding value THEN the Visual Design Studio SHALL update the element styling and canvas in real-time
4. WHEN spacing values are modified THEN the Visual Design Studio SHALL accept numeric input with optional unit specification

### Requirement 9: Visual Effects Controls

**User Story:** As a designer, I want to apply visual effects like filters and masks, so that I can enhance element appearance without code.

#### Acceptance Criteria

1. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display a Gray filter toggle with a slider ranging from 0 to 100 percent
2. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display an Invert filter toggle with a slider ranging from 0 to 100 percent
3. WHEN a user adjusts a filter slider THEN the Visual Design Studio SHALL apply the filter value to the element in real-time
4. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display Alpha Mask controls with a slider ranging from 0 to 100 percent
5. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display mask Angle controls with a slider ranging from 0 to 360 degrees

### Requirement 10: 2D Transform Controls

**User Story:** As a designer, I want to apply 2D transforms to elements, so that I can position, rotate, scale, and skew elements visually.

#### Acceptance Criteria

1. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display Translate controls for X and Y axes with numeric inputs
2. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display Skew controls for X and Y axes in degrees
3. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display a Rotate control for 2D rotation in degrees
4. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display a Scale control as a percentage value
5. WHEN a user adjusts any 2D transform control THEN the Visual Design Studio SHALL apply the transform to the element in real-time

### Requirement 11: 3D Transform Controls

**User Story:** As a designer, I want to apply 3D transforms to elements, so that I can create depth and perspective effects.

#### Acceptance Criteria

1. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display 3D Rotate controls for X, Y, and Z axes
2. WHEN the Property Inspector is in EDIT mode THEN the Visual Design Studio SHALL display a Perspective control to adjust 3D depth intensity
3. WHEN a user adjusts any 3D transform control THEN the Visual Design Studio SHALL apply the transform to the element in real-time
4. WHEN perspective is applied THEN the Visual Design Studio SHALL render the 3D effect correctly on the canvas

### Requirement 12: Real-time Canvas Updates

**User Story:** As a designer, I want all changes to reflect instantly on the canvas, so that I can see the results of my modifications immediately.

#### Acceptance Criteria

1. WHEN any property value is modified in the Property Inspector THEN the Visual Design Studio SHALL update the canvas within 100 milliseconds
2. WHEN multiple properties are changed in rapid succession THEN the Visual Design Studio SHALL batch updates to maintain performance
3. WHEN a change fails to apply THEN the Visual Design Studio SHALL display an error indicator and revert to the previous valid state

### Requirement 13: Copy and Paste Styles

**User Story:** As a designer, I want to copy and paste styles between elements, so that I can quickly apply consistent styling.

#### Acceptance Criteria

1. WHEN a user clicks the copy styles button THEN the Visual Design Studio SHALL store the current element styles in a clipboard
2. WHEN a user clicks the paste styles button on a different element THEN the Visual Design Studio SHALL apply the copied styles to that element
3. WHEN styles are pasted THEN the Visual Design Studio SHALL merge the pasted styles with existing element styles
4. WHEN no styles have been copied THEN the Visual Design Studio SHALL disable the paste styles button

### Requirement 14: Serialization and Persistence

**User Story:** As a designer, I want my style changes to be saved and restored, so that I can continue editing across sessions.

#### Acceptance Criteria

1. WHEN a style change is made THEN the Visual Design Studio SHALL serialize the change to a persistable format
2. WHEN the project is loaded THEN the Visual Design Studio SHALL deserialize and apply all saved style changes
3. WHEN serializing style data THEN the Visual Design Studio SHALL produce valid JSON output
4. WHEN deserializing style data THEN the Visual Design Studio SHALL restore the exact same visual state
5. WHEN serializing and then deserializing style data THEN the Visual Design Studio SHALL produce equivalent style objects
