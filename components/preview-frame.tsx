"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { RefreshCw, Loader2 } from "lucide-react"
import { DeviceMode } from "@/stores/editor-store"

export interface SelectedElementInfo {
  selector: string;
  type: string;
  styles: Record<string, string | number>;
  properties: Record<string, any>;
  clickPosition: { x: number; y: number };
}

interface PreviewFrameProps {
  htmlContent: string
  deviceMode: DeviceMode
  className?: string
  onElementSelect?: (element: SelectedElementInfo) => void
  isDesignMode?: boolean
}

const deviceDimensions: Record<DeviceMode, { width: number; height: number }> = {
  desktop: { width: 1200, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
}

export function PreviewFrame({
  htmlContent,
  deviceMode,
  className,
  onElementSelect,
  isDesignMode = false,
}: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [key, setKey] = useState(0)
  
  const dimensions = deviceDimensions[deviceMode]

  // Update iframe content when HTML changes
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    
    setIsLoading(true)
    
    // Write the HTML content to the iframe
    doc.open()
    doc.write(htmlContent)
    doc.close()
    
    // Wait for content to load
    const checkLoaded = () => {
      setIsLoading(false)
    }
    
    if (doc.readyState === "complete") {
      checkLoaded()
    } else {
      iframe.onload = checkLoaded
    }
  }, [htmlContent, key])

  // Refresh the preview
  const handleRefresh = useCallback(() => {
    setKey((prev) => prev + 1)
  }, [])

  // Add design mode event listeners
  useEffect(() => {
    if (!isDesignMode) return
    
    const iframe = iframeRef.current
    if (!iframe) return
    
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    const handleClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const target = e.target as HTMLElement
      if (target && onElementSelect) {
        // Create a unique selector for the element
        const path = getElementPath(target)
        
        // Get click position relative to the iframe container
        const iframeRect = iframe.getBoundingClientRect()
        const clickPosition = {
          x: e.clientX + iframeRect.left,
          y: e.clientY + iframeRect.top
        }
        
        // Extract styles
        const computed = window.getComputedStyle(target)
        const styles: Record<string, string | number> = {
          width: computed.width,
          height: computed.height,
          marginTop: parseFloat(computed.marginTop),
          marginRight: parseFloat(computed.marginRight),
          marginBottom: parseFloat(computed.marginBottom),
          marginLeft: parseFloat(computed.marginLeft),
          paddingTop: parseFloat(computed.paddingTop),
          paddingRight: parseFloat(computed.paddingRight),
          paddingBottom: parseFloat(computed.paddingBottom),
          paddingLeft: parseFloat(computed.paddingLeft),
          fontFamily: computed.fontFamily,
          fontSize: parseFloat(computed.fontSize),
          fontWeight: parseFloat(computed.fontWeight),
          textAlign: computed.textAlign,
          color: rgbToHex(computed.color),
          backgroundColor: rgbToHex(computed.backgroundColor),
          opacity: parseFloat(computed.opacity),
          borderRadius: parseFloat(computed.borderRadius),
          borderStyle: computed.borderStyle,
          borderWidth: parseFloat(computed.borderWidth),
          borderColor: rgbToHex(computed.borderColor),
        }

        // Extract attributes
        const properties = {
          id: target.id,
          className: target.className,
          tagName: target.tagName.toLowerCase(),
        }

        onElementSelect({
          selector: path,
          type: target.tagName.toLowerCase(),
          styles,
          properties,
          clickPosition
        })
      }
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target && target !== doc.body && target !== doc.documentElement) {
        target.style.outline = "2px solid #3b82f6"
        target.style.outlineOffset = "2px"
      }
    }

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target) {
        target.style.outline = ""
        target.style.outlineOffset = ""
      }
    }

    // Wait for content to be ready
    const timer = setTimeout(() => {
      doc.addEventListener("click", handleClick)
      doc.addEventListener("mouseover", handleMouseOver)
      doc.addEventListener("mouseout", handleMouseOut)
    }, 100)

    return () => {
      clearTimeout(timer)
      doc.removeEventListener("click", handleClick)
      doc.removeEventListener("mouseover", handleMouseOver)
      doc.removeEventListener("mouseout", handleMouseOut)
    }
  }, [isDesignMode, htmlContent, onElementSelect, key])

  return (
    <div className={cn("relative flex flex-col", className)}>
      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        className="absolute top-2 right-2 z-10 p-1.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors backdrop-blur-sm"
        title="Refresh preview"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      )}
      
      {/* Preview container with device frame */}
      <div className="flex-1 flex items-center justify-center overflow-auto bg-zinc-900 p-4">
        <div
          className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          <iframe
            ref={iframeRef}
            key={key}
            title="Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={{
              backgroundColor: "white",
            }}
          />
        </div>
      </div>
      
      {/* Device info bar */}
      <div className="h-8 flex items-center justify-center bg-zinc-800/50 text-xs text-zinc-500 border-t border-zinc-800">
        {deviceMode.charAt(0).toUpperCase() + deviceMode.slice(1)} • {dimensions.width}×{dimensions.height}
      </div>
    </div>
  )
}

// Helper function to get a unique path to an element
function getElementPath(element: HTMLElement): string {
  const path: string[] = []
  let current: HTMLElement | null = element
  
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase()
    
    if (current.id) {
      selector += `#${current.id}`
      path.unshift(selector)
      break
    } else if (current.className && typeof current.className === "string") {
      const classes = current.className.split(" ").filter(Boolean).slice(0, 2).join(".")
      if (classes) {
        selector += `.${classes}`
      }
    }
    
    // Add nth-child for disambiguation
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current!.tagName
      )
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-child(${index})`
      }
    }
    
    path.unshift(selector)
    current = current.parentElement
  }
  
  return path.join(" > ")
}

function rgbToHex(rgb: string): string {
  if (rgb.startsWith('#')) return rgb;
  if (rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return 'transparent';
  
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
  if (!match) return rgb;
  
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
