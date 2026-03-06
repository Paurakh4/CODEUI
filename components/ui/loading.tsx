'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './spinner'

interface LoadingOverlayProps extends React.ComponentProps<'div'> {
  /** Whether the overlay is visible */
  isLoading?: boolean
  /** Loading message to display */
  message?: string
  /** Whether to blur the background content */
  blur?: boolean
  /** Whether to cover the full screen or just the parent container */
  fullScreen?: boolean
}

function LoadingOverlay({
  isLoading = true,
  message,
  blur = true,
  fullScreen = false,
  className,
  children,
  ...props
}: LoadingOverlayProps) {
  if (!isLoading) return <>{children}</>

  return (
    <div className={cn('relative', className)} {...props}>
      {children}
      <div
        className={cn(
          'absolute inset-0 z-50 flex flex-col items-center justify-center gap-3',
          'bg-background/80',
          blur && 'backdrop-blur-sm motion-reduce:backdrop-blur-none',
          'animate-in fade-in-0 duration-[--duration-normal]',
          fullScreen && 'fixed',
          'motion-reduce:animate-none'
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Spinner size="lg" className="text-primary" />
        {message && (
          <p className="text-sm text-muted-foreground animate-pulse motion-reduce:animate-none">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

interface DotPulseLoaderProps extends React.ComponentProps<'div'> {
  /** Size of the dots */
  size?: 'sm' | 'default' | 'lg'
}

const dotSizeClasses = {
  sm: 'size-1.5',
  default: 'size-2',
  lg: 'size-3',
}

function DotPulseLoader({ size = 'default', className, ...props }: DotPulseLoaderProps) {
  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="status"
      aria-label="Loading"
      {...props}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            dotSizeClasses[size],
            'rounded-full bg-current animate-dot-pulse',
            'motion-reduce:animate-none motion-reduce:opacity-100'
          )}
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  )
}

interface LoadingButtonContentProps {
  isLoading: boolean
  children: React.ReactNode
  loadingText?: string
  spinnerPosition?: 'left' | 'right'
}

function LoadingButtonContent({
  isLoading,
  children,
  loadingText,
  spinnerPosition = 'left',
}: LoadingButtonContentProps) {
  if (!isLoading) return <>{children}</>

  return (
    <>
      {spinnerPosition === 'left' && <Spinner className="mr-2" />}
      <span className="animate-pulse motion-reduce:animate-none">
        {loadingText || children}
      </span>
      {spinnerPosition === 'right' && <Spinner className="ml-2" />}
    </>
  )
}

interface ProgressLoaderProps extends React.ComponentProps<'div'> {
  /** Progress value from 0 to 100 */
  progress?: number
  /** Whether to show indeterminate progress */
  indeterminate?: boolean
}

function ProgressLoader({
  progress = 0,
  indeterminate = false,
  className,
  ...props
}: ProgressLoaderProps) {
  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : progress}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <div
        className={cn(
          'h-full bg-primary transition-all duration-[--duration-normal] ease-[--ease-default]',
          indeterminate && 'animate-[progress-indeterminate_1.5s_ease-in-out_infinite] w-1/3',
          'motion-reduce:transition-none'
        )}
        style={!indeterminate ? { width: `${Math.min(100, Math.max(0, progress))}%` } : undefined}
      />
    </div>
  )
}

export { LoadingOverlay, DotPulseLoader, LoadingButtonContent, ProgressLoader }
