'use client'

import * as React from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'

// Animation variants for different transition styles
const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

const slideDownVariants: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
}

const slideLeftVariants: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

const slideRightVariants: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
}

const scaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}

const variantMap = {
  fade: fadeVariants,
  slideUp: slideUpVariants,
  slideDown: slideDownVariants,
  slideLeft: slideLeftVariants,
  slideRight: slideRightVariants,
  scale: scaleVariants,
}

type TransitionVariant = keyof typeof variantMap

interface PageTransitionProps {
  children: React.ReactNode
  /** Unique key for the current page/content - triggers animation on change */
  pageKey: string
  /** Animation variant style */
  variant?: TransitionVariant
  /** Animation duration in seconds */
  duration?: number
  /** Delay before animation starts */
  delay?: number
  /** Whether to wait for exit animation before entering */
  mode?: 'wait' | 'sync' | 'popLayout'
  /** Custom className for the motion container */
  className?: string
}

/**
 * Page transition wrapper component for smooth content transitions.
 * Use this to wrap page content or sections that should animate when changing.
 * 
 * @example
 * ```tsx
 * <PageTransition pageKey={pathname} variant="slideUp">
 *   <PageContent />
 * </PageTransition>
 * ```
 */
function PageTransition({
  children,
  pageKey,
  variant = 'fade',
  duration = 0.25,
  delay = 0,
  mode = 'wait',
  className,
}: PageTransitionProps) {
  const variants = variantMap[variant]

  // Check for reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // If user prefers reduced motion, skip animations
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <AnimatePresence mode={mode}>
      <motion.div
        key={pageKey}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{
          duration,
          delay,
          ease: [0.4, 0, 0.2, 1], // ease-default equivalent
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

interface FadeInProps {
  children: React.ReactNode
  /** Delay before animation starts (in seconds) */
  delay?: number
  /** Animation duration (in seconds) */
  duration?: number
  /** Direction to animate from */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  /** Distance to animate (in pixels) */
  distance?: number
  /** Custom className */
  className?: string
  /** Whether to trigger animation only once when in view */
  once?: boolean
}

/**
 * Simple fade-in animation component for content that should animate on mount.
 * 
 * @example
 * ```tsx
 * <FadeIn delay={0.1} direction="up">
 *   <Card>Content</Card>
 * </FadeIn>
 * ```
 */
function FadeIn({
  children,
  delay = 0,
  duration = 0.4,
  direction = 'up',
  distance = 16,
  className,
  once = true,
}: FadeInProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
  }, [])

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  const directionOffset = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...directionOffset[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once }}
      transition={{
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface StaggerContainerProps {
  children: React.ReactNode
  /** Delay between each child animation (in seconds) */
  staggerDelay?: number
  /** Custom className */
  className?: string
}

/**
 * Container for staggered child animations.
 * Wrap this around multiple FadeIn components for sequential animations.
 * 
 * @example
 * ```tsx
 * <StaggerContainer staggerDelay={0.1}>
 *   <FadeIn><Card>1</Card></FadeIn>
 *   <FadeIn><Card>2</Card></FadeIn>
 *   <FadeIn><Card>3</Card></FadeIn>
 * </StaggerContainer>
 * ```
 */
function StaggerContainer({
  children,
  staggerDelay = 0.1,
  className,
}: StaggerContainerProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
  }, [])

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {React.Children.map(children, (child) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

export { PageTransition, FadeIn, StaggerContainer }
export type { PageTransitionProps, FadeInProps, StaggerContainerProps, TransitionVariant }
