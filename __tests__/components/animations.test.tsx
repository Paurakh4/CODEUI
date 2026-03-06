import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import components to test
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar } from '@/components/ui/skeleton'
import {
  LoadingOverlay,
  DotPulseLoader,
  LoadingButtonContent,
  ProgressLoader,
} from '@/components/ui/loading'

describe('Animation Design System', () => {
  describe('Button Animations', () => {
    it('should have transition classes for smooth animations', () => {
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('transition-all')
      expect(button.className).toContain('duration-[--duration-fast]')
    })

    it('should have hover scale animation classes', () => {
      render(<Button>Hover me</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('hover:scale-[1.02]')
    })

    it('should have active press animation classes', () => {
      render(<Button>Press me</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('active:scale-[0.98]')
    })

    it('should respect reduced motion preference', () => {
      render(<Button>Accessible</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('motion-reduce:hover:scale-100')
      expect(button.className).toContain('motion-reduce:active:scale-100')
    })

    it('should apply different variants correctly', () => {
      const { rerender } = render(<Button variant="default">Default</Button>)
      let button = screen.getByRole('button')
      expect(button.className).toContain('hover:bg-primary/90')
      expect(button.className).toContain('active:bg-primary/80')

      rerender(<Button variant="destructive">Destructive</Button>)
      button = screen.getByRole('button')
      expect(button.className).toContain('active:bg-destructive/80')

      rerender(<Button variant="ghost">Ghost</Button>)
      button = screen.getByRole('button')
      expect(button.className).toContain('active:bg-accent/80')
    })
  })

  describe('Input Animations', () => {
    it('should have focus transition classes', () => {
      render(<Input placeholder="Enter text" />)
      const input = screen.getByPlaceholderText('Enter text')
      expect(input.className).toContain('transition-[color,box-shadow,border-color,transform]')
      expect(input.className).toContain('duration-[--duration-fast]')
    })

    it('should have hover border state', () => {
      render(<Input placeholder="Hover input" />)
      const input = screen.getByPlaceholderText('Hover input')
      expect(input.className).toContain('hover:border-ring/50')
    })

    it('should have validation shake animation class', () => {
      render(<Input aria-invalid="true" placeholder="Invalid input" />)
      const input = screen.getByPlaceholderText('Invalid input')
      expect(input.className).toContain('aria-invalid:animate-shake')
    })

    it('should respect reduced motion for validation', () => {
      render(<Input placeholder="Accessible input" />)
      const input = screen.getByPlaceholderText('Accessible input')
      expect(input.className).toContain('motion-reduce:aria-invalid:animate-none')
    })
  })

  describe('Textarea Animations', () => {
    it('should have transition classes', () => {
      render(<Textarea placeholder="Enter message" />)
      const textarea = screen.getByPlaceholderText('Enter message')
      expect(textarea.className).toContain('transition-[color,box-shadow,border-color]')
    })

    it('should have shake animation for invalid state', () => {
      render(<Textarea placeholder="Message" />)
      const textarea = screen.getByPlaceholderText('Message')
      expect(textarea.className).toContain('aria-invalid:animate-shake')
    })
  })

  describe('Checkbox Animations', () => {
    it('should have transition classes', () => {
      render(<Checkbox aria-label="Accept terms" />)
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox.className).toContain('transition-all')
      expect(checkbox.className).toContain('duration-[--duration-fast]')
    })

    it('should have hover scale animation', () => {
      render(<Checkbox aria-label="Terms" />)
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox.className).toContain('hover:scale-105')
    })

    it('should have active press state', () => {
      render(<Checkbox aria-label="Terms" />)
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox.className).toContain('active:scale-95')
    })

    it('should respect reduced motion', () => {
      render(<Checkbox aria-label="Terms" />)
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox.className).toContain('motion-reduce:hover:scale-100')
      expect(checkbox.className).toContain('motion-reduce:active:scale-100')
    })
  })

  describe('Spinner Component', () => {
    it('should render with accessible status role', () => {
      render(<Spinner />)
      const spinner = screen.getByRole('status')
      expect(spinner).toBeInTheDocument()
    })

    it('should render with different size props', () => {
      const { rerender } = render(<Spinner size="sm" />)
      expect(screen.getByRole('status')).toBeInTheDocument()

      rerender(<Spinner size="lg" />)
      expect(screen.getByRole('status')).toBeInTheDocument()

      rerender(<Spinner size="xl" />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('should have accessible label', () => {
      render(<Spinner />)
      const spinner = screen.getByLabelText('Loading')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Skeleton Component', () => {
    it('should render with default pulse animation', () => {
      render(<Skeleton data-testid="skeleton" />)
      const skeleton = screen.getByTestId('skeleton')
      expect(skeleton.className).toContain('animate-pulse')
    })

    it('should render with shimmer variant', () => {
      render(<Skeleton variant="shimmer" data-testid="skeleton" />)
      const skeleton = screen.getByTestId('skeleton')
      expect(skeleton.className).toContain('animate-skeleton')
    })

    it('should respect reduced motion', () => {
      render(<Skeleton data-testid="skeleton" />)
      const skeleton = screen.getByTestId('skeleton')
      expect(skeleton.className).toContain('motion-reduce:animate-none')
    })

    it('should render SkeletonText with multiple lines', () => {
      render(<SkeletonText lines={3} data-testid="skeleton-text" />)
      const container = screen.getByTestId('skeleton-text')
      const lines = container.querySelectorAll('[data-slot="skeleton"]')
      expect(lines).toHaveLength(3)
    })

    it('should render SkeletonCard with correct structure', () => {
      render(<SkeletonCard data-testid="skeleton-card" />)
      const card = screen.getByTestId('skeleton-card')
      expect(card).toBeInTheDocument()
    })

    it('should render SkeletonAvatar with different sizes', () => {
      const { rerender } = render(<SkeletonAvatar size="sm" data-testid="avatar" />)
      let avatar = screen.getByTestId('avatar')
      expect(avatar.className).toContain('size-8')

      rerender(<SkeletonAvatar size="lg" data-testid="avatar" />)
      avatar = screen.getByTestId('avatar')
      expect(avatar.className).toContain('size-12')
    })
  })

  describe('Loading Components', () => {
    describe('LoadingOverlay', () => {
      it('should render children when not loading', () => {
        render(
          <LoadingOverlay isLoading={false}>
            <div>Content</div>
          </LoadingOverlay>
        )
        expect(screen.getByText('Content')).toBeInTheDocument()
      })

      it('should show overlay when loading', () => {
        render(
          <LoadingOverlay isLoading={true}>
            <div>Content</div>
          </LoadingOverlay>
        )
        // The spinner inside LoadingOverlay has role="status"
        expect(screen.getByLabelText('Loading')).toBeInTheDocument()
      })

      it('should display loading message', () => {
        render(
          <LoadingOverlay isLoading={true} message="Please wait...">
            <div>Content</div>
          </LoadingOverlay>
        )
        expect(screen.getByText('Please wait...')).toBeInTheDocument()
      })

      it('should have aria attributes for accessibility', () => {
        render(
          <LoadingOverlay isLoading={true}>
            <div>Content</div>
          </LoadingOverlay>
        )
        // Check the overlay container has proper aria attributes
        const overlayContainer = screen.getByText('Content').parentElement?.querySelector('[aria-busy="true"]')
        expect(overlayContainer).toBeInTheDocument()
      })
    })

    describe('DotPulseLoader', () => {
      it('should render three dots', () => {
        render(<DotPulseLoader data-testid="dot-loader" />)
        const loader = screen.getByTestId('dot-loader')
        const dots = loader.querySelectorAll('span:not(.sr-only)')
        expect(dots).toHaveLength(3)
      })

      it('should have pulse animation class', () => {
        render(<DotPulseLoader data-testid="dot-loader" />)
        const loader = screen.getByTestId('dot-loader')
        const dots = loader.querySelectorAll('span:not(.sr-only)')
        dots.forEach((dot) => {
          expect(dot.className).toContain('animate-dot-pulse')
        })
      })

      it('should have accessible label', () => {
        render(<DotPulseLoader />)
        expect(screen.getByLabelText('Loading')).toBeInTheDocument()
      })
    })

    describe('LoadingButtonContent', () => {
      it('should render children when not loading', () => {
        render(
          <LoadingButtonContent isLoading={false}>
            Submit
          </LoadingButtonContent>
        )
        expect(screen.getByText('Submit')).toBeInTheDocument()
      })

      it('should render spinner when loading', () => {
        render(
          <LoadingButtonContent isLoading={true}>
            Submit
          </LoadingButtonContent>
        )
        expect(screen.getByRole('status')).toBeInTheDocument()
      })

      it('should show custom loading text', () => {
        render(
          <LoadingButtonContent isLoading={true} loadingText="Submitting...">
            Submit
          </LoadingButtonContent>
        )
        expect(screen.getByText('Submitting...')).toBeInTheDocument()
      })
    })

    describe('ProgressLoader', () => {
      it('should render with progress value', () => {
        render(<ProgressLoader progress={50} data-testid="progress" />)
        const progress = screen.getByTestId('progress')
        expect(progress).toHaveAttribute('aria-valuenow', '50')
      })

      it('should render indeterminate state', () => {
        render(<ProgressLoader indeterminate data-testid="progress" />)
        const progress = screen.getByTestId('progress')
        expect(progress).not.toHaveAttribute('aria-valuenow')
      })

      it('should have accessible role', () => {
        render(<ProgressLoader progress={25} />)
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
      })
    })
  })
})

describe('Reduced Motion Accessibility', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>

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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Button should include motion-reduce modifiers', () => {
    render(<Button>Test</Button>)
    const button = screen.getByRole('button')
    // Verify reduced motion classes exist
    expect(button.className).toMatch(/motion-reduce/)
  })

  it('Input should include motion-reduce modifiers', () => {
    render(<Input placeholder="test" />)
    const input = screen.getByPlaceholderText('test')
    expect(input.className).toMatch(/motion-reduce/)
  })

  it('Checkbox should include motion-reduce modifiers', () => {
    render(<Checkbox aria-label="test" />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox.className).toMatch(/motion-reduce/)
  })

  it('Skeleton should include motion-reduce modifiers', () => {
    render(<Skeleton data-testid="skeleton" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton.className).toMatch(/motion-reduce/)
  })
})

describe('Animation Timing Consistency', () => {
  const EXPECTED_FAST_DURATION = '--duration-fast'
  const EXPECTED_NORMAL_DURATION = '--duration-normal'

  it('Button should use fast duration for micro-interactions', () => {
    render(<Button>Test</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toContain(EXPECTED_FAST_DURATION)
  })

  it('Input should use fast duration for focus transitions', () => {
    render(<Input placeholder="test" />)
    const input = screen.getByPlaceholderText('test')
    expect(input.className).toContain(EXPECTED_FAST_DURATION)
  })

  it('Checkbox should use fast duration', () => {
    render(<Checkbox aria-label="test" />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox.className).toContain(EXPECTED_FAST_DURATION)
  })
})
