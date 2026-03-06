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
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
