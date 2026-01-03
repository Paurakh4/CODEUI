"use client"

import { useState, useCallback, useRef, useEffect } from "react"

// ============================================================================
// TYPES
// ============================================================================

export interface StyleChange {
  id: string
  selector: string
  property: string
  oldValue: string | number
  newValue: string | number
  timestamp: number
}

export interface StyleHistoryState {
  past: StyleChange[][]
  present: StyleChange[] | null
  future: StyleChange[][]
}

export interface StyleHistoryActions {
  pushChange: (change: StyleChange) => void
  batchChanges: (changes: StyleChange[]) => void
  undo: () => StyleChange[] | null
  redo: () => StyleChange[] | null
  canUndo: boolean
  canRedo: boolean
  clear: () => void
  getHistory: () => StyleHistoryState
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_HISTORY_SIZE = 50
const BATCH_DELAY_MS = 300
const STORAGE_KEY = "style-panel-history"

// ============================================================================
// HOOK: useStyleHistory
// ============================================================================

export function useStyleHistory(
  maxSize: number = MAX_HISTORY_SIZE
): [StyleHistoryState, StyleHistoryActions] {
  const [state, setState] = useState<StyleHistoryState>({
    past: [],
    present: null,
    future: [],
  })

  const batchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingChangesRef = useRef<StyleChange[]>([])

  // Flush pending batched changes to history
  const flushBatch = useCallback(() => {
    if (pendingChangesRef.current.length === 0) return

    const batch = [...pendingChangesRef.current]
    pendingChangesRef.current = []

    setState((prev) => {
      const newPast = prev.present
        ? [...prev.past, prev.present].slice(-maxSize)
        : prev.past

      return {
        past: newPast,
        present: batch,
        future: [], // Clear redo stack on new change
      }
    })
  }, [maxSize])

  // Push a single change (will be batched)
  const pushChange = useCallback(
    (change: StyleChange) => {
      // Check if this is a continuation of the same property change
      const lastPending = pendingChangesRef.current[pendingChangesRef.current.length - 1]
      
      if (
        lastPending &&
        lastPending.selector === change.selector &&
        lastPending.property === change.property
      ) {
        // Update the last change's newValue instead of adding a new one
        lastPending.newValue = change.newValue
        lastPending.timestamp = change.timestamp
      } else {
        pendingChangesRef.current.push(change)
      }

      // Reset batch timer
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
      }
      batchTimerRef.current = setTimeout(flushBatch, BATCH_DELAY_MS)
    },
    [flushBatch]
  )

  // Batch multiple changes at once
  const batchChanges = useCallback(
    (changes: StyleChange[]) => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
      }
      pendingChangesRef.current = []

      setState((prev) => {
        const newPast = prev.present
          ? [...prev.past, prev.present].slice(-maxSize)
          : prev.past

        return {
          past: newPast,
          present: changes,
          future: [],
        }
      })
    },
    [maxSize]
  )

  // Undo the last change
  const undo = useCallback((): StyleChange[] | null => {
    // First flush any pending changes
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }
    if (pendingChangesRef.current.length > 0) {
      flushBatch()
    }

    let undoneChanges: StyleChange[] | null = null

    setState((prev) => {
      if (prev.past.length === 0) return prev

      const newPast = prev.past.slice(0, -1)
      const previousState = prev.past[prev.past.length - 1]
      undoneChanges = prev.present

      return {
        past: newPast,
        present: previousState,
        future: prev.present
          ? [prev.present, ...prev.future].slice(0, maxSize)
          : prev.future,
      }
    })

    return undoneChanges
  }, [flushBatch, maxSize])

  // Redo the last undone change
  const redo = useCallback((): StyleChange[] | null => {
    let redoneChanges: StyleChange[] | null = null

    setState((prev) => {
      if (prev.future.length === 0) return prev

      const [nextState, ...restFuture] = prev.future
      redoneChanges = nextState

      return {
        past: prev.present
          ? [...prev.past, prev.present].slice(-maxSize)
          : prev.past,
        present: nextState,
        future: restFuture,
      }
    })

    return redoneChanges
  }, [maxSize])

  // Clear all history
  const clear = useCallback(() => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }
    pendingChangesRef.current = []

    setState({
      past: [],
      present: null,
      future: [],
    })
  }, [])

  // Get current history state
  const getHistory = useCallback(() => state, [state])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
      }
    }
  }, [])

  const actions: StyleHistoryActions = {
    pushChange,
    batchChanges,
    undo,
    redo,
    canUndo: state.past.length > 0 || state.present !== null,
    canRedo: state.future.length > 0,
    clear,
    getHistory,
  }

  return [state, actions]
}

// ============================================================================
// HOOK: useStylePersistence
// ============================================================================

export interface PersistedStyles {
  [selector: string]: Record<string, string | number>
}

export interface StylePersistenceOptions {
  storageKey?: string
  debounceMs?: number
  enabled?: boolean
}

export function useStylePersistence(
  options: StylePersistenceOptions = {}
) {
  const {
    storageKey = STORAGE_KEY,
    debounceMs = 500,
    enabled = true,
  } = options

  const [persistedStyles, setPersistedStyles] = useState<PersistedStyles>({})
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load persisted styles on mount
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        setPersistedStyles(parsed)
      }
    } catch (e) {
      console.warn("Failed to load persisted styles:", e)
    }
  }, [enabled, storageKey])

  // Save styles with debouncing
  const saveStyles = useCallback(
    (styles: PersistedStyles) => {
      if (!enabled || typeof window === "undefined") return

      setPersistedStyles(styles)

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(styles))
        } catch (e) {
          console.warn("Failed to persist styles:", e)
        }
      }, debounceMs)
    },
    [enabled, storageKey, debounceMs]
  )

  // Update a single style
  const updateStyle = useCallback(
    (selector: string, property: string, value: string | number) => {
      setPersistedStyles((prev) => {
        const updated = {
          ...prev,
          [selector]: {
            ...prev[selector],
            [property]: value,
          },
        }
        saveStyles(updated)
        return updated
      })
    },
    [saveStyles]
  )

  // Get styles for a specific selector
  const getStyles = useCallback(
    (selector: string): Record<string, string | number> => {
      return persistedStyles[selector] || {}
    },
    [persistedStyles]
  )

  // Clear all persisted styles
  const clearStyles = useCallback(() => {
    setPersistedStyles({})
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(storageKey)
      } catch (e) {
        console.warn("Failed to clear persisted styles:", e)
      }
    }
  }, [storageKey])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  return {
    persistedStyles,
    saveStyles,
    updateStyle,
    getStyles,
    clearStyles,
  }
}
