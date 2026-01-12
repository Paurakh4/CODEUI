"use client"

import * as React from 'react'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'

function Card({ className, children, ...props }: React.ComponentProps<'div'>) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Gradient colors matching gradient-ai-chat-input
  const mainGradient = {
    light: {
      topLeft: "#F5E9AD",
      topRight: "#F6B4AD", 
      bottomRight: "#F5ABA0",
      bottomLeft: "#F5DCBA"
    },
    dark: {
      topLeft: "#B8905A",
      topRight: "#B86B42",
      bottomRight: "#A8502D",
      bottomLeft: "#B89E6E"
    }
  }

  const outerGradient = {
    light: {
      topLeft: "#E5D99D",
      topRight: "#E6A49D",
      bottomRight: "#E59B90", 
      bottomLeft: "#E5CCBA"
    },
    dark: {
      topLeft: "#996F40",
      topRight: "#99532D",   
      bottomRight: "#8A3F22",
      bottomLeft: "#997D50"
    }
  }

  const currentMainGradient = isDark ? mainGradient.dark : mainGradient.light
  const currentOuterGradient = isDark ? outerGradient.dark : outerGradient.light

  return (
    <div className={cn("relative group", className)} {...props}>
      {/* Outer gradient border */}
      <div className="absolute -inset-[0.5px] rounded-xl z-0 pointer-events-none"
           style={{
             background: `conic-gradient(from 0deg at 50% 50%,
               ${currentOuterGradient.topLeft} 0deg,
               ${currentOuterGradient.topRight} 90deg,
               ${currentOuterGradient.bottomRight} 180deg,
               ${currentOuterGradient.bottomLeft} 270deg,
               ${currentOuterGradient.topLeft} 360deg
             )`
           }}
      />
        
      {/* Main gradient border */}
      <div className="absolute inset-[0.5px] rounded-[11.5px] z-0 pointer-events-none"
           style={{
             padding: '2px',
             background: `conic-gradient(from 0deg at 50% 50%,
               ${currentMainGradient.topLeft} 0deg,
               ${currentMainGradient.topRight} 90deg,
               ${currentMainGradient.bottomRight} 180deg,
               ${currentMainGradient.bottomLeft} 270deg,
               ${currentMainGradient.topLeft} 360deg
             )`
           }}
      >
        {/* Inner background to mask the center of the main gradient */}
        <div className="h-full w-full bg-card rounded-[9.5px]" />
      </div>

      {/* Actual Content */}
      <div
        data-slot="card"
        className="relative z-10 flex flex-col gap-6 rounded-[9.5px] py-6 shadow-sm bg-transparent"
      >
        {children}
      </div>
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className,
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-6', className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-6 [.border-t]:pt-6', className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
