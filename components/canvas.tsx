"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"

interface CanvasProps {
  className?: string
}

export function Canvas({ className }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [startPan, setStartPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or space + left click for panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      setIsPanning(true)
      setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }, [position])

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    
    const newX = e.clientX - startPan.x
    const newY = e.clientY - startPan.y
    setPosition({ x: newX, y: newY })
  }, [isPanning, startPan])

  // Handle mouse up to stop panning
  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Handle wheel for zooming and panning
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    // Check if it's a pinch zoom gesture (ctrlKey is true for pinch on trackpad)
    if (e.ctrlKey) {
      // Zoom
      const delta = e.deltaY * -0.01
      const newScale = Math.min(Math.max(0.1, scale + delta), 5)
      
      // Get mouse position relative to container
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        
        // Calculate new position to zoom towards mouse
        const scaleRatio = newScale / scale
        const newX = mouseX - (mouseX - position.x) * scaleRatio
        const newY = mouseY - (mouseY - position.y) * scaleRatio
        
        setPosition({ x: newX, y: newY })
      }
      
      setScale(newScale)
    } else {
      // Pan with two-finger scroll
      setPosition(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }))
    }
  }, [scale, position])

  // Attach wheel event listener with passive: false
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  // Prevent browser zoom
  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
      }
    }
    window.addEventListener('wheel', preventZoom, { passive: false })
    return () => window.removeEventListener('wheel', preventZoom)
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Reset zoom with Ctrl/Cmd + 0
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        setScale(1)
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          setPosition({
            x: (rect.width - 1200) / 2,
            y: (rect.height - 800) / 2
          })
        }
      }
      // Zoom in with Ctrl/Cmd + =
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setScale(prev => Math.min(5, prev + 0.1))
      }
      // Zoom out with Ctrl/Cmd + -
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        setScale(prev => Math.max(0.1, prev - 0.1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full overflow-hidden bg-zinc-900",
        isPanning ? "cursor-grabbing" : "cursor-grab",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Canvas Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)
          `,
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          backgroundPosition: `${position.x}px ${position.y}px`,
        }}
      />

      {/* Artboard / Design Canvas */}
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          width: '1200px',
          height: '800px',
        }}
      >
        {/* Main Artboard */}
        <div className="w-full h-full bg-[#18181b] rounded-lg shadow-2xl overflow-hidden">
          {/* Artboard content - can be replaced with actual design elements */}
          <div className="w-full h-full flex items-center justify-center bg-[#111111] border-10 border-zinc-700/40 rounded-2xl">
            <div className="text-center space-y-4">
              <div className="text-zinc-400 text-lg font-medium">
                Canvas
              </div>
              <div className="text-zinc-300 text-sm max-w-md mx-auto">
                <p>• Scroll/Two-finger drag to pan</p>
                <p>• Pinch or Ctrl + scroll to zoom</p>
                <p>• Alt + drag to pan</p>
                <p>• Ctrl + 0 to reset view</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-zinc-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-medium">
        {Math.round(scale * 100)}%
      </div>

      {/* Position indicator (for debugging, can be removed) */}
      <div className="absolute bottom-4 left-4 bg-zinc-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-zinc-400 font-mono">
        x: {Math.round(position.x)} y: {Math.round(position.y)}
      </div>
    </div>
  )
}
