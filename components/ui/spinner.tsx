import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SpinnerProps extends React.ComponentProps<'svg'> {
  size?: 'sm' | 'default' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'size-3',
  default: 'size-4',
  lg: 'size-6',
  xl: 'size-8',
}

function Spinner({ className, size = 'default', ...props }: SpinnerProps) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn(
        sizeClasses[size],
        'animate-spin motion-reduce:animate-[spin_1.5s_linear_infinite]',
        className
      )}
      {...props}
    />
  )
}

export { Spinner }
