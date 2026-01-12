import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthSessionProvider } from '@/components/session-provider'
import { AuthDialogProvider } from '@/components/auth-dialog-provider'
import { EditorProvider } from '@/stores/editor-store'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeUI - The Last UI',
  description: 'AI-powered code editor interface',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <AuthSessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <AuthDialogProvider>
              <EditorProvider>
                {children}
                <Toaster />
              </EditorProvider>
            </AuthDialogProvider>
          </ThemeProvider>
        </AuthSessionProvider>
        <Analytics />
      </body>
    </html>
  )
}
