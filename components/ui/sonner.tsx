'use client'

import { useTheme } from 'next-themes'
import * as React from 'react'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // On server and first render, use system/light to match default
  // Once mounted, use the actual theme
  const activeTheme = mounted ? (theme as ToasterProps['theme']) : 'system'

  return (
    <Sonner
      theme={activeTheme}
      className="toaster group"
      position="bottom-right"
      closeButton
      richColors
      visibleToasts={3}
      toastOptions={{
        duration: 5000,
      }}
      style={
        {
          '--normal-bg': 'var(--toast-glass)',
          '--normal-text': 'var(--foreground)',
          '--normal-border': 'var(--toast-border)',
          '--error-bg': 'var(--toast-glass-error)',
          '--error-text': 'var(--foreground)',
          '--error-border': 'var(--toast-border)',
          '--success-bg': 'var(--toast-glass-success)',
          '--success-text': 'var(--foreground)',
          '--success-border': 'var(--toast-border)',
          '--warning-bg': 'var(--toast-glass-warning)',
          '--warning-text': 'var(--foreground)',
          '--warning-border': 'var(--toast-border)',
          '--info-bg': 'var(--toast-glass-info)',
          '--info-text': 'var(--foreground)',
          '--info-border': 'var(--toast-border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
