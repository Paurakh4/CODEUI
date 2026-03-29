export type ElementPropertyValue = string | boolean | undefined
export type ElementPropertyMap = Record<string, ElementPropertyValue>

export type ElementPropertyControl = "text" | "dropdown" | "boolean"
export type ElementPropertySection = "attributes" | "link" | "image" | "button" | "field" | "media" | "list"

export interface ElementPropertyOption {
  value: string
  label: string
}

export interface ElementPropertyField {
  key: string
  label: string
  control: ElementPropertyControl
  section: ElementPropertySection
  attributeName?: string
  propertyName?: string
  placeholder?: string
  options?: ElementPropertyOption[]
  tags?: string[]
}

const LINK_TARGET_OPTIONS: ElementPropertyOption[] = [
  { value: "_self", label: "Same Tab" },
  { value: "_blank", label: "New Tab" },
  { value: "_parent", label: "Parent" },
  { value: "_top", label: "Top" },
]

const LOADING_OPTIONS: ElementPropertyOption[] = [
  { value: "eager", label: "Eager" },
  { value: "lazy", label: "Lazy" },
]

const DECODING_OPTIONS: ElementPropertyOption[] = [
  { value: "auto", label: "Auto" },
  { value: "async", label: "Async" },
  { value: "sync", label: "Sync" },
]

const BUTTON_TYPE_OPTIONS: ElementPropertyOption[] = [
  { value: "button", label: "Button" },
  { value: "submit", label: "Submit" },
  { value: "reset", label: "Reset" },
]

const INPUT_TYPE_OPTIONS: ElementPropertyOption[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "password", label: "Password" },
  { value: "number", label: "Number" },
  { value: "tel", label: "Telephone" },
  { value: "url", label: "URL" },
  { value: "search", label: "Search" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio" },
  { value: "file", label: "File" },
  { value: "hidden", label: "Hidden" },
]

const AUTOCOMPLETE_OPTIONS: ElementPropertyOption[] = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "username", label: "Username" },
  { value: "organization", label: "Organization" },
  { value: "street-address", label: "Street Address" },
]

const TEXTAREA_WRAP_OPTIONS: ElementPropertyOption[] = [
  { value: "soft", label: "Soft" },
  { value: "hard", label: "Hard" },
]

const PRELOAD_OPTIONS: ElementPropertyOption[] = [
  { value: "auto", label: "Auto" },
  { value: "metadata", label: "Metadata" },
  { value: "none", label: "None" },
]

const ORDERED_LIST_TYPE_OPTIONS: ElementPropertyOption[] = [
  { value: "1", label: "Numbers" },
  { value: "a", label: "Lower Alpha" },
  { value: "A", label: "Upper Alpha" },
  { value: "i", label: "Lower Roman" },
  { value: "I", label: "Upper Roman" },
]

const ELEMENT_PROPERTY_FIELDS: ElementPropertyField[] = [
  { key: "id", label: "ID", control: "text", section: "attributes", attributeName: "id", placeholder: "element-id" },
  { key: "className", label: "Class", control: "text", section: "attributes", attributeName: "class", propertyName: "className", placeholder: "class-names" },
  { key: "title", label: "Title", control: "text", section: "attributes", attributeName: "title", placeholder: "Tooltip text" },

  { key: "href", label: "Href", control: "text", section: "link", attributeName: "href", placeholder: "https://...", tags: ["a"] },
  { key: "target", label: "Target", control: "dropdown", section: "link", attributeName: "target", options: LINK_TARGET_OPTIONS, tags: ["a"] },
  { key: "rel", label: "Rel", control: "text", section: "link", attributeName: "rel", placeholder: "noopener noreferrer", tags: ["a"] },
  { key: "download", label: "Download", control: "text", section: "link", attributeName: "download", placeholder: "file-name.pdf", tags: ["a"] },

  { key: "src", label: "Source", control: "text", section: "image", attributeName: "src", placeholder: "image url...", tags: ["img"] },
  { key: "alt", label: "Alt Text", control: "text", section: "image", attributeName: "alt", placeholder: "description...", tags: ["img"] },
  { key: "loading", label: "Loading", control: "dropdown", section: "image", attributeName: "loading", options: LOADING_OPTIONS, tags: ["img"] },
  { key: "decoding", label: "Decoding", control: "dropdown", section: "image", attributeName: "decoding", options: DECODING_OPTIONS, tags: ["img"] },

  { key: "type", label: "Type", control: "dropdown", section: "button", attributeName: "type", options: BUTTON_TYPE_OPTIONS, tags: ["button"] },
  { key: "name", label: "Name", control: "text", section: "button", attributeName: "name", placeholder: "action-name", tags: ["button"] },
  { key: "disabled", label: "Disabled", control: "boolean", section: "button", attributeName: "disabled", propertyName: "disabled", tags: ["button"] },

  { key: "name", label: "Name", control: "text", section: "field", attributeName: "name", placeholder: "field-name", tags: ["input", "textarea", "select"] },
  { key: "type", label: "Input Type", control: "dropdown", section: "field", attributeName: "type", options: INPUT_TYPE_OPTIONS, tags: ["input"] },
  { key: "placeholder", label: "Placeholder", control: "text", section: "field", attributeName: "placeholder", placeholder: "Hint text", tags: ["input", "textarea"] },
  { key: "required", label: "Required", control: "boolean", section: "field", attributeName: "required", propertyName: "required", tags: ["input", "textarea", "select"] },
  { key: "disabled", label: "Disabled", control: "boolean", section: "field", attributeName: "disabled", propertyName: "disabled", tags: ["input", "textarea", "select"] },
  { key: "readOnly", label: "Read Only", control: "boolean", section: "field", attributeName: "readonly", propertyName: "readOnly", tags: ["input", "textarea"] },
  { key: "min", label: "Min", control: "text", section: "field", attributeName: "min", placeholder: "0", tags: ["input"] },
  { key: "max", label: "Max", control: "text", section: "field", attributeName: "max", placeholder: "100", tags: ["input"] },
  { key: "step", label: "Step", control: "text", section: "field", attributeName: "step", placeholder: "1", tags: ["input"] },
  { key: "pattern", label: "Pattern", control: "text", section: "field", attributeName: "pattern", placeholder: "[A-Za-z]+", tags: ["input"] },
  { key: "autocomplete", label: "Autocomplete", control: "dropdown", section: "field", attributeName: "autocomplete", options: AUTOCOMPLETE_OPTIONS, tags: ["input"] },
  { key: "rows", label: "Rows", control: "text", section: "field", attributeName: "rows", placeholder: "4", tags: ["textarea"] },
  { key: "cols", label: "Columns", control: "text", section: "field", attributeName: "cols", placeholder: "40", tags: ["textarea"] },
  { key: "wrap", label: "Wrap", control: "dropdown", section: "field", attributeName: "wrap", options: TEXTAREA_WRAP_OPTIONS, tags: ["textarea"] },
  { key: "multiple", label: "Multiple", control: "boolean", section: "field", attributeName: "multiple", propertyName: "multiple", tags: ["select"] },
  { key: "size", label: "Visible Options", control: "text", section: "field", attributeName: "size", placeholder: "4", tags: ["select"] },

  { key: "src", label: "Source", control: "text", section: "media", attributeName: "src", placeholder: "video url...", tags: ["video"] },
  { key: "poster", label: "Poster", control: "text", section: "media", attributeName: "poster", placeholder: "poster image...", tags: ["video"] },
  { key: "preload", label: "Preload", control: "dropdown", section: "media", attributeName: "preload", options: PRELOAD_OPTIONS, tags: ["video"] },
  { key: "controls", label: "Controls", control: "boolean", section: "media", attributeName: "controls", propertyName: "controls", tags: ["video"] },
  { key: "autoplay", label: "Autoplay", control: "boolean", section: "media", attributeName: "autoplay", propertyName: "autoplay", tags: ["video"] },
  { key: "muted", label: "Muted", control: "boolean", section: "media", attributeName: "muted", propertyName: "muted", tags: ["video"] },
  { key: "loop", label: "Loop", control: "boolean", section: "media", attributeName: "loop", propertyName: "loop", tags: ["video"] },

  { key: "start", label: "Start", control: "text", section: "list", attributeName: "start", placeholder: "1", tags: ["ol"] },
  { key: "reversed", label: "Reversed", control: "boolean", section: "list", attributeName: "reversed", propertyName: "reversed", tags: ["ol"] },
  { key: "type", label: "Marker Type", control: "dropdown", section: "list", attributeName: "type", options: ORDERED_LIST_TYPE_OPTIONS, tags: ["ol"] },
  { key: "value", label: "Item Value", control: "text", section: "list", attributeName: "value", placeholder: "3", tags: ["li"] },
]

function appliesToTag(field: ElementPropertyField, tagName: string) {
  return !field.tags || field.tags.includes(tagName)
}

export function getElementPropertyFields(tagName: string, section?: ElementPropertySection) {
  const normalizedTagName = tagName.toLowerCase()

  return ELEMENT_PROPERTY_FIELDS.filter((field) => {
    if (!appliesToTag(field, normalizedTagName)) return false
    if (section && field.section !== section) return false
    return true
  })
}

export function getElementPropertySections(tagName: string) {
  const normalizedTagName = tagName.toLowerCase()
  const sections = new Set<ElementPropertySection>(["attributes"])

  for (const field of ELEMENT_PROPERTY_FIELDS) {
    if (field.section === "attributes") continue
    if (appliesToTag(field, normalizedTagName)) {
      sections.add(field.section)
    }
  }

  return Array.from(sections)
}