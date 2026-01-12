"use client"

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
  useEffect,
} from "react"

const CINEMATHEQUE_TEMPLATE_ENDPOINT = "/api/templates/cinematheque-preview"
const LOADING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Loading preview…</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: #0b0b0c; color: #eaeaea; }
    .wrap { min-height: 100vh; display: grid; place-items: center; }
    .card { max-width: 560px; padding: 24px 20px; border: 1px solid #222; background: #121214; }
    .muted { color: #a1a1aa; margin-top: 8px; }
  </style>
</head>
<body>
  <!-- CINEMATHEQUE_TEMPLATE_LOADING -->
  <div class="wrap">
    <div class="card">
      <div>Loading Cinematheque preview template…</div>
      <div class="muted">If this persists, refresh.</div>
    </div>
  </div>
</body>
</html>`

// Types
export type ViewMode = "preview" | "design" | "code"
export type DeviceMode = "desktop" | "tablet" | "mobile"

export interface Version {
  id: string
  htmlContent: string
  timestamp: Date
  description?: string
}

export interface Project {
  id: string
  name: string
  emoji?: string
  htmlContent: string
  versions: Version[]
  createdAt: Date
  updatedAt: Date
  isPrivate: boolean
}

export interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  isThinking?: boolean
  thinkingContent?: string
}

export interface EditorState {
  // Current project
  project: Project | null
  htmlContent: string
  
  // UI State
  viewMode: ViewMode
  deviceMode: DeviceMode
  sidebarOpen: boolean
  
  // AI State
  messages: Message[]
  isGenerating: boolean
  
  // Editor State
  hasUnsavedChanges: boolean
  selectedElement: string | null
  
  // Version History
  versions: Version[]
  currentVersionId: string | null
  
  // Settings
  selectedModel: string
  primaryColor: string
  secondaryColor: string
  theme: "light" | "dark"
}

// Initial State
const initialState: EditorState = {
  project: null,
  htmlContent: LOADING_HTML,
  
  viewMode: "preview",
  deviceMode: "desktop",
  sidebarOpen: true,
  
  messages: [],
  isGenerating: false,
  
  hasUnsavedChanges: false,
  selectedElement: null,
  
  versions: [],
  currentVersionId: null,
  
  selectedModel: "deepseek/deepseek-chat",
  primaryColor: "blue",
  secondaryColor: "slate",
  theme: "dark",
}

// Action Types
type EditorAction =
  | { type: "SET_HTML_CONTENT"; payload: string }
  | { type: "SET_HTML_CONTENT_INITIAL"; payload: string }
  | { type: "SET_VIEW_MODE"; payload: ViewMode }
  | { type: "SET_DEVICE_MODE"; payload: DeviceMode }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_SIDEBAR_OPEN"; payload: boolean }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "UPDATE_MESSAGE"; payload: { id: string; updates: Partial<Message> } }
  | { type: "SET_GENERATING"; payload: boolean }
  | { type: "SET_UNSAVED_CHANGES"; payload: boolean }
  | { type: "SET_SELECTED_ELEMENT"; payload: string | null }
  | { type: "CREATE_VERSION"; payload: { description?: string } }
  | { type: "RESTORE_VERSION"; payload: string }
  | { type: "SET_MODEL"; payload: string }
  | { type: "SET_PRIMARY_COLOR"; payload: string }
  | { type: "SET_SECONDARY_COLOR"; payload: string }
  | { type: "SET_THEME"; payload: "light" | "dark" }
  | { type: "SET_PROJECT"; payload: Project }
  | { type: "RESET_STATE" }

// Reducer
function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_HTML_CONTENT":
      return { 
        ...state, 
        htmlContent: action.payload, 
        hasUnsavedChanges: true 
      }

    case "SET_HTML_CONTENT_INITIAL":
      return {
        ...state,
        htmlContent: action.payload,
        hasUnsavedChanges: false,
      }
    
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload }
    
    case "SET_DEVICE_MODE":
      return { ...state, deviceMode: action.payload }
    
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarOpen: !state.sidebarOpen }
    
    case "SET_SIDEBAR_OPEN":
      return { ...state, sidebarOpen: action.payload }
    
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] }
    
    case "UPDATE_MESSAGE": {
      const { id, updates } = action.payload
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === id ? { ...msg, ...updates } : msg
        ),
      }
    }
    
    case "SET_GENERATING":
      return { ...state, isGenerating: action.payload }
    
    case "SET_UNSAVED_CHANGES":
      return { ...state, hasUnsavedChanges: action.payload }
    
    case "SET_SELECTED_ELEMENT":
      return { ...state, selectedElement: action.payload }
    
    case "CREATE_VERSION": {
      const newVersion: Version = {
        id: Date.now().toString(),
        htmlContent: state.htmlContent,
        timestamp: new Date(),
        description: action.payload.description,
      }
      return {
        ...state,
        versions: [...state.versions, newVersion],
        currentVersionId: newVersion.id,
        hasUnsavedChanges: false,
      }
    }
    
    case "RESTORE_VERSION": {
      const version = state.versions.find((v) => v.id === action.payload)
      if (version) {
        return {
          ...state,
          htmlContent: version.htmlContent,
          currentVersionId: version.id,
          hasUnsavedChanges: false,
        }
      }
      return state
    }
    
    case "SET_MODEL":
      return { ...state, selectedModel: action.payload }
    
    case "SET_PRIMARY_COLOR":
      return { ...state, primaryColor: action.payload }
    
    case "SET_SECONDARY_COLOR":
      return { ...state, secondaryColor: action.payload }
    
    case "SET_THEME":
      return { ...state, theme: action.payload }
    
    case "SET_PROJECT":
      return {
        ...state,
        project: action.payload,
        htmlContent: action.payload.htmlContent,
        versions: action.payload.versions,
        hasUnsavedChanges: false,
      }
    
    case "RESET_STATE":
      return initialState
    
    default:
      return state
  }
}

// Context
interface EditorContextValue {
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
  
  // Convenience actions
  setHtmlContent: (content: string) => void
  setViewMode: (mode: ViewMode) => void
  setDeviceMode: (mode: DeviceMode) => void
  toggleSidebar: () => void
  addMessage: (message: Omit<Message, "id" | "timestamp">) => string
  updateMessage: (id: string, updates: Partial<Message>) => void
  setGenerating: (generating: boolean) => void
  createVersion: (description?: string) => void
  restoreVersion: (versionId: string) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

// Provider
export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState)

  // Load default preview template (Cinematheque) once the provider mounts.
  useEffect(() => {
    if (!state.htmlContent.includes("CINEMATHEQUE_TEMPLATE_LOADING")) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(CINEMATHEQUE_TEMPLATE_ENDPOINT)
        if (!res.ok) return
        const templateHtml = await res.text()
        if (cancelled) return
        dispatch({ type: "SET_HTML_CONTENT_INITIAL", payload: templateHtml })
      } catch {
        // Keep LOADING_HTML on failure.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [state.htmlContent])
  
  const setHtmlContent = useCallback((content: string) => {
    dispatch({ type: "SET_HTML_CONTENT", payload: content })
  }, [])
  
  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch({ type: "SET_VIEW_MODE", payload: mode })
  }, [])
  
  const setDeviceMode = useCallback((mode: DeviceMode) => {
    dispatch({ type: "SET_DEVICE_MODE", payload: mode })
  }, [])
  
  const toggleSidebar = useCallback(() => {
    dispatch({ type: "TOGGLE_SIDEBAR" })
  }, [])
  
  const addMessage = useCallback((message: Omit<Message, "id" | "timestamp">) => {
    const id = Date.now().toString()
    dispatch({
      type: "ADD_MESSAGE",
      payload: {
        ...message,
        id,
        timestamp: new Date(),
      },
    })
    return id
  }, [])
  
  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    dispatch({ type: "UPDATE_MESSAGE", payload: { id, updates } })
  }, [])
  
  const setGenerating = useCallback((generating: boolean) => {
    dispatch({ type: "SET_GENERATING", payload: generating })
  }, [])
  
  const createVersion = useCallback((description?: string) => {
    dispatch({ type: "CREATE_VERSION", payload: { description } })
  }, [])
  
  const restoreVersion = useCallback((versionId: string) => {
    dispatch({ type: "RESTORE_VERSION", payload: versionId })
  }, [])
  
  const value: EditorContextValue = {
    state,
    dispatch,
    setHtmlContent,
    setViewMode,
    setDeviceMode,
    toggleSidebar,
    addMessage,
    updateMessage,
    setGenerating,
    createVersion,
    restoreVersion,
  }
  
  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  )
}

// Hook
export function useEditor() {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider")
  }
  return context
}
