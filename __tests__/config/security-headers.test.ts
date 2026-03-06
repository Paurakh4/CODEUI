import nextConfig from '../../next.config.mjs'
import { describe, expect, it } from 'vitest'

describe('Next.js security headers config', () => {
  it('applies CSP and standard security headers to app pages only', async () => {
    expect(typeof nextConfig.headers).toBe('function')

    const configuredHeaders = await nextConfig.headers?.()
    expect(configuredHeaders).toBeDefined()
    expect(configuredHeaders).toHaveLength(1)

    const [entry] = configuredHeaders || []
    expect(entry.source).toBe('/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)')

    const headerMap = new Map(entry.headers.map((header) => [header.key.toLowerCase(), header.value]))

    const csp = headerMap.get('content-security-policy')
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com")
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com")
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com data:")
    expect(csp).toContain("connect-src 'self' https://openrouter.ai")

    expect(headerMap.get('x-content-type-options')).toBe('nosniff')
    expect(headerMap.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(headerMap.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(headerMap.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()')

    expect(headerMap.get('strict-transport-security')).toBeUndefined()
  })
})
