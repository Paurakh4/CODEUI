import { cn } from '@/lib/utils'

interface SkeletonProps extends React.ComponentProps<'div'> {
  variant?: 'default' | 'shimmer' | 'pulse'
}

function Skeleton({ className, variant = 'pulse', ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'rounded-md',
        variant === 'pulse' && 'bg-accent animate-pulse',
        variant === 'shimmer' && 'animate-skeleton',
        variant === 'default' && 'bg-accent',
        'motion-reduce:animate-none motion-reduce:bg-accent',
        className
      )}
      {...props}
    />
  )
}

// Pre-built skeleton components for common use cases
function SkeletonText({ className, lines = 1, ...props }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}

function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn('space-y-3', className)} {...props}>
      <Skeleton className="h-32 w-full" />
      <SkeletonText lines={2} />
    </div>
  )
}

function SkeletonAvatar({ className, size = 'default', ...props }: SkeletonProps & { size?: 'sm' | 'default' | 'lg' }) {
  const sizeClasses = {
    sm: 'size-8',
    default: 'size-10',
    lg: 'size-12',
  }
  
  return (
    <Skeleton
      className={cn('rounded-full', sizeClasses[size], className)}
      {...props}
    />
  )
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar }
