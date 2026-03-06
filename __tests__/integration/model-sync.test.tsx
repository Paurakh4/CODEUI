import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EditorProvider, useEditor } from '@/stores/editor-store'
import React, { useEffect } from 'react'

// Mock useToast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast
  })
}))

// Mock child component to consume context
const TestComponent = () => {
  const { state, setModel } = useEditor()
  return (
    <div>
      <div data-testid="selected-model">{state.selectedModel}</div>
      <div data-testid="available-models">{JSON.stringify(state.availableModels)}</div>
      <button onClick={() => setModel('new-model')}>Change Model</button>
    </div>
  )
}

describe('EditorProvider Model Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    
    // Mock fetch
    global.fetch = vi.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          models: [
            { id: 'google/gemini-3-flash-preview', name: 'CODEUI GOD MODE' },
            { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
            { id: 'new-model', name: 'New Model' }
          ]
        })
      })
    ) as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads models on mount and validates default', async () => {
    render(
      <EditorProvider>
        <TestComponent />
      </EditorProvider>
    )

    // Wait for fetch to complete (useEffect)
    // We look for the text inside the JSON string
    await screen.findByText(/DeepSeek V3/) 
    
    // Default selectedModel should prefer CODEUI GOD MODE
    expect(screen.getByTestId('selected-model').textContent).toBe('google/gemini-3-flash-preview')
  })

  it('updates localStorage when model changes', async () => {
    render(
      <EditorProvider>
        <TestComponent />
      </EditorProvider>
    )

    await screen.findByText(/CODEUI GOD MODE/)

    const button = screen.getByText('Change Model')
    fireEvent.click(button)

    expect(screen.getByTestId('selected-model').textContent).toBe('new-model')
    await waitFor(() => {
      expect(localStorage.getItem('selected_model')).toBe('new-model')
    })
  })

  it('syncs from storage event', async () => {
    render(
      <EditorProvider>
        <TestComponent />
      </EditorProvider>
    )

    await screen.findByText(/CODEUI GOD MODE/)

    // Simulate storage event from another tab
    act(() => {
      const event = new StorageEvent('storage', {
        key: 'selected_model',
        newValue: 'new-model',
        storageArea: localStorage
      })
      window.dispatchEvent(event)
    })

    expect(screen.getByTestId('selected-model').textContent).toBe('new-model')
  })

  it('validates selected model against available models', async () => {
    // Mock fetch to return different models where current default is invalid
    global.fetch = vi.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          models: [
            { id: 'google/gemini-3-flash-preview', name: 'Gemini' },
            { id: 'other-model', name: 'Other' }
          ]
        })
      })
    ) as any

    render(
      <EditorProvider>
        <TestComponent />
      </EditorProvider>
    )

    // Should switch to google/gemini-3-flash-preview because deepseek-chat is not in the list
    // We need to wait for the fetch and validation logic to run
    // The available models string should update
    await screen.findByText(/Gemini/)
    
    // Expect selected model to change to the valid one
    expect(screen.getByTestId('selected-model').textContent).toBe('google/gemini-3-flash-preview')
  })

  it('handles fetch failure with fallback models and toast', async () => {
    // Mock fetch to fail
    global.fetch = vi.fn(() => Promise.reject('Network error')) as any

    render(
      <EditorProvider>
        <TestComponent />
      </EditorProvider>
    )

    // Wait for fallback models to appear
    await screen.findByText(/CODEUI GOD MODE/)

    // Expect fallback models to be available
    expect(screen.getByTestId('available-models').textContent).toContain('CODEUI GOD MODE')
    
    // Verify toast was called
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Model Unavailable",
      variant: "destructive"
    }))
  })

  it('handles invalid model ID in localStorage', async () => {
    // Set invalid model in localStorage
    localStorage.setItem('selected_model', 'invalid-model')

    render(
      <EditorProvider>
        <TestComponent />
      </EditorProvider>
    )

    // Wait for fetch
    await screen.findByText(/DeepSeek V3/)

    // Should fallback to CODEUI GOD MODE when localStorage is invalid.
    
    expect(screen.getByTestId('selected-model').textContent).toBe('google/gemini-3-flash-preview')
  })
})
