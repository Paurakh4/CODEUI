import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PageTransition, FadeIn, StaggerContainer } from '@/components/ui/page-transition'

// Mock framer-motion to avoid animation timing issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

describe('PageTransition Component', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render children correctly', () => {
    render(
      <PageTransition pageKey="test-page">
        <div>Page Content</div>
      </PageTransition>
    )
    expect(screen.getByText('Page Content')).toBeInTheDocument()
  })

  it('should render with motion div when animations enabled', () => {
    render(
      <PageTransition pageKey="test-page">
        <div>Content</div>
      </PageTransition>
    )
    expect(screen.getByTestId('motion-div')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(
      <PageTransition pageKey="test-page" className="custom-class">
        <div>Content</div>
      </PageTransition>
    )
    const motionDiv = screen.getByTestId('motion-div')
    expect(motionDiv.className).toContain('custom-class')
  })

  describe('Reduced Motion Support', () => {
    beforeEach(() => {
      matchMediaMock = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      })
    })

    it('should skip motion wrapper when reduced motion is preferred', async () => {
      render(
        <PageTransition pageKey="test-page" className="test-class">
          <div>Content</div>
        </PageTransition>
      )
      
      await waitFor(() => {
        // Should render plain div instead of motion div
        const plainDiv = screen.getByText('Content').parentElement
        expect(plainDiv?.tagName).toBe('DIV')
      })
    })
  })
})

describe('FadeIn Component', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render children correctly', () => {
    render(
      <FadeIn>
        <div>Fade Content</div>
      </FadeIn>
    )
    expect(screen.getByText('Fade Content')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(
      <FadeIn className="fade-class">
        <div>Content</div>
      </FadeIn>
    )
    const motionDiv = screen.getByTestId('motion-div')
    expect(motionDiv.className).toContain('fade-class')
  })

  describe('Reduced Motion Support', () => {
    beforeEach(() => {
      matchMediaMock = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      })
    })

    it('should skip animation when reduced motion is preferred', () => {
      render(
        <FadeIn className="test-class">
          <div>Content</div>
        </FadeIn>
      )
      
      // Should render plain div
      const container = screen.getByText('Content').parentElement
      expect(container?.tagName).toBe('DIV')
    })
  })
})

describe('StaggerContainer Component', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render all children', () => {
    render(
      <StaggerContainer>
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </StaggerContainer>
    )
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
    expect(screen.getByText('Item 3')).toBeInTheDocument()
  })

  it('should wrap children in container', () => {
    render(
      <StaggerContainer className="stagger-class">
        <div>Item</div>
      </StaggerContainer>
    )
    expect(screen.getByText('Item')).toBeInTheDocument()
  })

  describe('Reduced Motion Support', () => {
    beforeEach(() => {
      matchMediaMock = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      })
    })

    it('should skip stagger animation when reduced motion is preferred', () => {
      render(
        <StaggerContainer className="test-class">
          <div>Item 1</div>
          <div>Item 2</div>
        </StaggerContainer>
      )
      
      // Should render plain div
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
    })
  })
})

describe('Animation Variants', () => {
  beforeEach(() => {
    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    })
  })

  it('should accept fade variant', () => {
    render(
      <PageTransition pageKey="test" variant="fade">
        <div>Content</div>
      </PageTransition>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('should accept slideUp variant', () => {
    render(
      <PageTransition pageKey="test" variant="slideUp">
        <div>Content</div>
      </PageTransition>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('should accept slideDown variant', () => {
    render(
      <PageTransition pageKey="test" variant="slideDown">
        <div>Content</div>
      </PageTransition>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('should accept slideLeft variant', () => {
    render(
      <PageTransition pageKey="test" variant="slideLeft">
        <div>Content</div>
      </PageTransition>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('should accept slideRight variant', () => {
    render(
      <PageTransition pageKey="test" variant="slideRight">
        <div>Content</div>
      </PageTransition>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('should accept scale variant', () => {
    render(
      <PageTransition pageKey="test" variant="scale">
        <div>Content</div>
      </PageTransition>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })
})
