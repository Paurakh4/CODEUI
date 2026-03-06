import { describe, it, expect } from 'vitest'
import { editorReducer, initialState, type EditorAction } from '@/stores/editor-store'

describe('editorReducer', () => {
  it('should handle SET_MODEL', () => {
    const action: EditorAction = { type: 'SET_MODEL', payload: 'new-model-id' }
    const newState = editorReducer(initialState, action)
    expect(newState.selectedModel).toBe('new-model-id')
  })

  it('should handle SET_AVAILABLE_MODELS', () => {
    const models = [{ id: 'm1', name: 'Model 1' }, { id: 'm2', name: 'Model 2' }]
    const action: EditorAction = { type: 'SET_AVAILABLE_MODELS', payload: models }
    const newState = editorReducer(initialState, action)
    expect(newState.availableModels).toEqual(models)
  })

  it('should handle SET_IS_LOADING_MODELS', () => {
    const action: EditorAction = { type: 'SET_IS_LOADING_MODELS', payload: false }
    const newState = editorReducer(initialState, action)
    expect(newState.isLoadingModels).toBe(false)
  })
})
