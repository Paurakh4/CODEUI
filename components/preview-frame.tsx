"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Grip, Loader2, LocateFixed, RefreshCw } from "lucide-react"
import { DeviceMode } from "@/stores/editor-store"

export interface SelectedElementInfo {
  selector: string;
  type: string;
  styles: Record<string, string | number>;
  properties: Record<string, any>;
  clickPosition: { x: number; y: number };
}

export interface PreviewFrameProps {
  htmlContent: string
  deviceMode: DeviceMode
  className?: string
  onElementSelect?: (element: SelectedElementInfo) => void
  onTextChange?: (selector: string, text: string) => void
  isDesignMode?: boolean
  forwardedRef?: React.RefObject<HTMLIFrameElement | null>
  isStyleUpdate?: boolean
}

const TRACKED_STYLE_PROPERTIES = [
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gap",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "color",
  "backgroundColor",
  "opacity",
  "borderRadius",
  "borderStyle",
  "borderWidth",
  "borderColor",
  "overflow",
  "boxShadow",
] as const

type TrackedStyleProperty = (typeof TRACKED_STYLE_PROPERTIES)[number]

export function extractSelectedElementStyles(
  element: HTMLElement,
  iframeWindow: Window,
): Record<string, string | number> {
  const computed = iframeWindow.getComputedStyle(element)

  return TRACKED_STYLE_PROPERTIES.reduce<Record<string, string | number>>((styles, property) => {
    const rawValue = (computed as CSSStyleDeclaration & Record<TrackedStyleProperty, string>)[property] ?? ""

    if (property === "color" || property === "backgroundColor" || property === "borderColor") {
      styles[property] = rgbToHex(rawValue)
      return styles
    }

    styles[property] = rawValue
    return styles
  }, {})
}

export function extractSelectedElementProperties(element: HTMLElement): Record<string, any> {
  const tagName = element.tagName.toLowerCase()

  return {
    id: element.id,
    className: element.className,
    tagName,
    textContent: element.textContent ?? "",
    href: element.getAttribute("href") ?? "",
    src: element.getAttribute("src") ?? "",
    alt: element.getAttribute("alt") ?? "",
  }
}

export function extractSelectedElementInfo(
  element: HTMLElement,
  iframeWindow: Window,
  clickPosition: { x: number; y: number },
): SelectedElementInfo {
  return {
    selector: getElementPath(element),
    type: element.tagName.toLowerCase(),
    styles: extractSelectedElementStyles(element, iframeWindow),
    properties: extractSelectedElementProperties(element),
    clickPosition,
  }
}

const deviceDimensions: Record<DeviceMode, { width: number; height: number }> = {
  desktop: { width: 1065, height: 740 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
}

const deviceChromeInsets: Record<DeviceMode, { width: number; height: number }> = {
  desktop: { width: 26, height: 26 },
  tablet: { width: 0, height: 0 },
  mobile: { width: 0, height: 0 },
}

const MIN_FRAME_WIDTH = 280
const MIN_FRAME_HEIGHT = 220
const CANVAS_GRID_SIZE = 32
const CANVAS_MAJOR_GRID_SIZE = 160
const CANVAS_FRAME_PADDING = 24
const MOVE_HANDLE_CLEARANCE = 56

type CanvasPoint = { x: number; y: number }
type FrameSize = { width: number; height: number }
type ResizeHandleDirection = "ne" | "nw" | "se" | "sw"

type CanvasInteraction =
  | {
      type: "pan"
      pointerId: number
      startPointer: CanvasPoint
      startCanvasOffset: CanvasPoint
    }
  | {
      type: "move"
      pointerId: number
      startPointer: CanvasPoint
      startFramePosition: CanvasPoint
    }
  | {
      type: "resize"
      pointerId: number
      direction: ResizeHandleDirection
      startPointer: CanvasPoint
      startFramePosition: CanvasPoint
      startFrameSize: FrameSize
    }

export function PreviewFrame({
  htmlContent,
  deviceMode,
  className,
  onElementSelect,
  onTextChange,
  isDesignMode = false,
  forwardedRef,
  isStyleUpdate = false,
}: PreviewFrameProps) {
  const localIframeRef = useRef<HTMLIFrameElement>(null)
  const iframeRef = forwardedRef || localIframeRef
  const canvasViewportRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<CanvasInteraction | null>(null)
  const onElementSelectRef = useRef(onElementSelect)
  const onTextChangeRef = useRef(onTextChange)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  const [canvasOffset, setCanvasOffset] = useState<CanvasPoint>({ x: 0, y: 0 })
  const [framePosition, setFramePosition] = useState<CanvasPoint>({ x: 0, y: 0 })
  const [frameSize, setFrameSize] = useState<FrameSize>(deviceDimensions[deviceMode])
  const [activeInteraction, setActiveInteraction] = useState<CanvasInteraction["type"] | null>(null)

  const hasPreviewShell = deviceMode === "desktop"
  const isTabletMode = deviceMode === "tablet"
  const frameShellClassName = cn(
    "relative flex-none touch-none",
    activeInteraction ? "transition-none" : "transition-all duration-300",
    hasPreviewShell ? "rounded-[24px] border border-white/5 bg-zinc-950/50 p-3" : "rounded-none border-0 bg-transparent p-0 shadow-none ring-0",
  )
  const frameClassName = cn(
    "bg-white shadow-2xl overflow-hidden",
    activeInteraction ? "transition-none" : "transition-all duration-300",
    isTabletMode ? "rounded-[28px]" : deviceMode === "mobile" ? "rounded-[24px]" : "rounded-lg",
  )
  const frameScreenPosition = {
    x: canvasOffset.x + framePosition.x,
    y: canvasOffset.y + framePosition.y,
  }
  const minorGridOffset = {
    x: mod(canvasOffset.x, CANVAS_GRID_SIZE),
    y: mod(canvasOffset.y, CANVAS_GRID_SIZE),
  }
  const majorGridOffset = {
    x: mod(canvasOffset.x, CANVAS_MAJOR_GRID_SIZE),
    y: mod(canvasOffset.y, CANVAS_MAJOR_GRID_SIZE),
  }

  const centerFrame = useCallback((nextSize: FrameSize) => {
    const viewport = canvasViewportRef.current
    if (!viewport) return

    const bounds = viewport.getBoundingClientRect()
    const outerDimensions = getFrameOuterDimensions(deviceMode, nextSize)
    const footprintDimensions = getFrameFootprintDimensions(deviceMode, nextSize)

    setCanvasOffset({
      x: Math.round((bounds.width - outerDimensions.width) / 2),
      y: Math.round((bounds.height - footprintDimensions.height) / 2 + MOVE_HANDLE_CLEARANCE),
    })
    setFramePosition({ x: 0, y: 0 })
  }, [deviceMode])

  const handleCenterFrame = useCallback(() => {
    centerFrame(frameSize)
  }, [centerFrame, frameSize])

  useEffect(() => {
    const viewport = canvasViewportRef.current
    const bounds = viewport?.getBoundingClientRect()
    const nextSize = getDefaultFrameSize(deviceMode, bounds)
    setFrameSize(nextSize)

    const rafId = window.requestAnimationFrame(() => {
      centerFrame(nextSize)
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [centerFrame, deviceMode])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current
      if (!interaction || interaction.pointerId !== event.pointerId) return

      event.preventDefault()

      const dx = event.clientX - interaction.startPointer.x
      const dy = event.clientY - interaction.startPointer.y

      if (interaction.type === "pan") {
        setCanvasOffset({
          x: interaction.startCanvasOffset.x + dx,
          y: interaction.startCanvasOffset.y + dy,
        })
        return
      }

      if (interaction.type === "move") {
        setFramePosition({
          x: interaction.startFramePosition.x + dx,
          y: interaction.startFramePosition.y + dy,
        })
        return
      }

      let nextWidth = interaction.startFrameSize.width
      let nextHeight = interaction.startFrameSize.height
      let nextX = interaction.startFramePosition.x
      let nextY = interaction.startFramePosition.y

      if (interaction.direction.includes("e")) {
        nextWidth = Math.max(MIN_FRAME_WIDTH, interaction.startFrameSize.width + dx)
      }

      if (interaction.direction.includes("s")) {
        nextHeight = Math.max(MIN_FRAME_HEIGHT, interaction.startFrameSize.height + dy)
      }

      if (interaction.direction.includes("w")) {
        const proposedWidth = interaction.startFrameSize.width - dx
        nextWidth = Math.max(MIN_FRAME_WIDTH, proposedWidth)
        nextX = interaction.startFramePosition.x + (interaction.startFrameSize.width - nextWidth)
      }

      if (interaction.direction.includes("n")) {
        const proposedHeight = interaction.startFrameSize.height - dy
        nextHeight = Math.max(MIN_FRAME_HEIGHT, proposedHeight)
        nextY = interaction.startFramePosition.y + (interaction.startFrameSize.height - nextHeight)
      }

      setFrameSize({
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      })
      setFramePosition({
        x: Math.round(nextX),
        y: Math.round(nextY),
      })
    }

    const stopInteraction = (pointerId?: number) => {
      const interaction = interactionRef.current
      if (!interaction) return
      if (pointerId != null && interaction.pointerId !== pointerId) return

      interactionRef.current = null
      setActiveInteraction(null)
    }

    const handlePointerUp = (event: PointerEvent) => {
      stopInteraction(event.pointerId)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      stopInteraction(event.pointerId)
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false })
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerCancel)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerCancel)
    }
  }, [])

  useEffect(() => {
    if (!activeInteraction) return

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect

    document.body.style.cursor = activeInteraction === "resize" ? "nwse-resize" : "grabbing"
    document.body.style.userSelect = "none"

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [activeInteraction])

  useEffect(() => {
    onElementSelectRef.current = onElementSelect
    onTextChangeRef.current = onTextChange
  }, [onElementSelect, onTextChange])

  const startPanInteraction = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    interactionRef.current = {
      type: "pan",
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startCanvasOffset: canvasOffset,
    }
    setActiveInteraction("pan")
  }, [canvasOffset])

  const startMoveInteraction = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()

    interactionRef.current = {
      type: "move",
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startFramePosition: framePosition,
    }
    setActiveInteraction("move")
  }, [framePosition])

  const startResizeInteraction = useCallback((direction: ResizeHandleDirection) => {
    return (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return

      event.preventDefault()
      event.stopPropagation()

      interactionRef.current = {
        type: "resize",
        pointerId: event.pointerId,
        direction,
        startPointer: { x: event.clientX, y: event.clientY },
        startFramePosition: framePosition,
        startFrameSize: frameSize,
      }
      setActiveInteraction("resize")
    }
  }, [framePosition, frameSize])

  // Update iframe content when HTML changes - use srcdoc for reliable rendering
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    // If this is just a style update that was applied manually to the DOM, skip reload
    if (isStyleUpdate) return
    
    setIsLoading(true)
    
    // Handle load event
    const handleLoad = () => {
      setIsLoading(false)
    }
    
    iframe.onload = handleLoad
    
    // Use srcdoc for reliable content rendering
    // This ensures the entire document is parsed before rendering
    iframe.srcdoc = htmlContent
    
    return () => {
      iframe.onload = null
    }
  }, [htmlContent, isStyleUpdate, reloadToken])

  // Refresh the preview
  const handleRefresh = useCallback(() => {
    setReloadToken((prev) => prev + 1)
  }, [])

  // Add design mode event listeners
  useEffect(() => {
    if (!isDesignMode) return

    const iframe = iframeRef.current
    if (!iframe) return

    let cleanupFn: (() => void) | null = null
    let activeDoc: Document | null = null
    let setupTimeoutId: number | null = null

    const clearPendingSetup = () => {
      if (setupTimeoutId !== null) {
        window.clearTimeout(setupTimeoutId)
        setupTimeoutId = null
      }
    }

    const cleanupCurrentListeners = () => {
      if (cleanupFn) {
        cleanupFn()
        cleanupFn = null
      }
      activeDoc = null
    }

    const setupEventListeners = () => {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (!doc || !doc.body) return
      if (activeDoc === doc) return

      cleanupCurrentListeners()
      activeDoc = doc
      const docNode = doc.defaultView?.Node

      let editingElement: HTMLElement | null = null
      let editingSelector = ""
      let originalText = ""
      let highlightedElement: HTMLElement | null = null
      let previousOutline = ""
      let previousOutlineOffset = ""

      const clearHighlightedElement = () => {
        if (!highlightedElement) return

        highlightedElement.style.outline = previousOutline
        highlightedElement.style.outlineOffset = previousOutlineOffset
        highlightedElement = null
        previousOutline = ""
        previousOutlineOffset = ""
      }

      const highlightElement = (element: HTMLElement) => {
        if (highlightedElement === element) return

        clearHighlightedElement()
        highlightedElement = element
        previousOutline = element.style.outline
        previousOutlineOffset = element.style.outlineOffset
        element.style.outline = "2px solid #3b82f6"
        element.style.outlineOffset = "2px"
      }

      const isEditing = (target: HTMLElement | null) => {
        if (!editingElement || !target) return false
        return editingElement === target || editingElement.contains(target)
      }

      const isEditableTextElement = (element: HTMLElement) => {
        const tag = element.tagName.toLowerCase()
        if ([
          "html",
          "body",
          "script",
          "style",
          "img",
          "svg",
          "path",
          "input",
          "textarea",
          "select",
        ].includes(tag)) {
          return false
        }

        const hasText = Array.from(element.childNodes).some((node) => {
          return node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
        })

        return hasText
      }

      const findEditableTextElement = (start: HTMLElement) => {
        let current: HTMLElement | null = start
        while (current && current !== doc.body && current !== doc.documentElement) {
          if (isEditableTextElement(current)) return current
          current = current.parentElement
        }
        return null
      }

      const stopEditing = (options?: { cancel?: boolean }) => {
        if (!editingElement) return

        const element = editingElement
        element.removeAttribute("contenteditable")
        element.removeEventListener("blur", handleEditingBlur)

        if (options?.cancel) {
          element.textContent = originalText
        } else {
          const newText = element.textContent ?? ""
          if (newText !== originalText) {
            onTextChangeRef.current?.(editingSelector, newText)
          }
        }

        editingElement = null
        editingSelector = ""
        originalText = ""
      }

      const handleEditingBlur = () => {
        stopEditing()
      }

      const startEditing = (element: HTMLElement) => {
        if (editingElement && editingElement !== element) {
          stopEditing()
        }

        editingElement = element
        editingSelector = getElementPath(element)
        originalText = element.textContent ?? ""

        element.setAttribute("contenteditable", "true")
        element.style.outline = ""
        element.style.outlineOffset = ""
        element.focus({ preventScroll: true })

        const selection = doc.getSelection()
        if (selection) {
          const range = doc.createRange()
          range.selectNodeContents(element)
          selection.removeAllRanges()
          selection.addRange(range)
        }

        element.addEventListener("blur", handleEditingBlur)
      }

      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (isEditing(target)) return

        e.preventDefault()
        e.stopPropagation()
        const selectHandler = onElementSelectRef.current
        if (target && selectHandler) {
          // Get click position relative to the iframe container
          const iframeRect = iframe.getBoundingClientRect()
          const clickPosition = {
            x: e.clientX + iframeRect.left,
            y: e.clientY + iframeRect.top
          }
          
          // Extract styles - use iframe's contentWindow for getComputedStyle
          const iframeWindow = iframe.contentWindow
          if (!iframeWindow) return

          selectHandler(extractSelectedElementInfo(target, iframeWindow, clickPosition))
        }
      }

      const handleMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (isEditing(target)) return
        if (target && target !== doc.body && target !== doc.documentElement) {
          highlightElement(target)
        }
      }

      const handleMouseOut = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (isEditing(target)) return
        const relatedTarget = e.relatedTarget
        if (
          target &&
          highlightedElement === target &&
          !(docNode && relatedTarget instanceof docNode && target.contains(relatedTarget))
        ) {
          clearHighlightedElement()
        }
      }

      const handleDoubleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        const editable = target ? findEditableTextElement(target) : null
        if (!editable) return

        e.preventDefault()
        e.stopPropagation()
        startEditing(editable)
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (!editingElement) return
        const target = e.target as HTMLElement
        if (!isEditing(target)) return

        if (e.key === "Enter") {
          e.preventDefault()
          stopEditing()
        }

        if (e.key === "Escape") {
          e.preventDefault()
          stopEditing({ cancel: true })
        }
      }

      doc.addEventListener("click", handleClick)
      doc.addEventListener("mouseover", handleMouseOver)
      doc.addEventListener("mouseout", handleMouseOut)
      doc.addEventListener("dblclick", handleDoubleClick)
      doc.addEventListener("keydown", handleKeyDown, true)

      cleanupFn = () => {
        clearHighlightedElement()
        doc.removeEventListener("click", handleClick)
        doc.removeEventListener("mouseover", handleMouseOver)
        doc.removeEventListener("mouseout", handleMouseOut)
        doc.removeEventListener("dblclick", handleDoubleClick)
        doc.removeEventListener("keydown", handleKeyDown, true)
        stopEditing({ cancel: true })
      }
    }

    const scheduleSetup = () => {
      clearPendingSetup()
      setupTimeoutId = window.setTimeout(() => {
        setupTimeoutId = null
        setupEventListeners()
      }, 50)
    }

    // Wait for iframe to load with srcdoc
    const handleIframeLoad = () => {
      cleanupCurrentListeners()
      scheduleSetup()
    }

    iframe.addEventListener("load", handleIframeLoad)

    // If already loaded, set up immediately
    if (iframe.contentDocument?.readyState === "complete") {
      scheduleSetup()
    }

    return () => {
      clearPendingSetup()
      iframe.removeEventListener("load", handleIframeLoad)
      cleanupCurrentListeners()
    }
  }, [iframeRef, isDesignMode, reloadToken])

  return (
    <div className={cn("relative flex flex-col", className)}>
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <button
          onClick={handleCenterFrame}
          className="rounded-md bg-zinc-800/85 p-1.5 text-zinc-400 backdrop-blur-sm transition-colors hover:bg-zinc-700 hover:text-zinc-100"
          title="Center preview"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
        <button
          onClick={handleRefresh}
          className="rounded-md bg-zinc-800/85 p-1.5 text-zinc-400 backdrop-blur-sm transition-colors hover:bg-zinc-700 hover:text-zinc-100"
          title="Refresh preview"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      )}
      
      <div
        ref={canvasViewportRef}
        className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(63,63,70,0.28),_transparent_42%),linear-gradient(to_bottom,_#111827,_#09090b)]"
      >
        <div
          className={cn(
            "absolute inset-0 touch-none",
            activeInteraction === "pan" ? "cursor-grabbing" : "cursor-grab"
          )}
          onPointerDown={startPanInteraction}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage: [
                "linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px)",
                "linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px)",
                "linear-gradient(to right, rgba(255,255,255,0.085) 1px, transparent 1px)",
                "linear-gradient(to bottom, rgba(255,255,255,0.085) 1px, transparent 1px)",
              ].join(", "),
              backgroundSize: [
                `${CANVAS_GRID_SIZE}px ${CANVAS_GRID_SIZE}px`,
                `${CANVAS_GRID_SIZE}px ${CANVAS_GRID_SIZE}px`,
                `${CANVAS_MAJOR_GRID_SIZE}px ${CANVAS_MAJOR_GRID_SIZE}px`,
                `${CANVAS_MAJOR_GRID_SIZE}px ${CANVAS_MAJOR_GRID_SIZE}px`,
              ].join(", "),
              backgroundPosition: [
                `${minorGridOffset.x}px ${minorGridOffset.y}px`,
                `${minorGridOffset.x}px ${minorGridOffset.y}px`,
                `${majorGridOffset.x}px ${majorGridOffset.y}px`,
                `${majorGridOffset.x}px ${majorGridOffset.y}px`,
              ].join(", "),
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_transparent_58%)]" />
        </div>

        <div
          className="absolute left-0 top-0 z-20"
          style={{
            transform: `translate3d(${frameScreenPosition.x}px, ${frameScreenPosition.y}px, 0)`,
          }}
        >
          <div className="relative">
            <button
              onPointerDown={startMoveInteraction}
              className={cn(
                "absolute left-1/2 -top-12 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-zinc-950/80 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-300 shadow-[0_12px_30px_rgba(0,0,0,0.3)] backdrop-blur-sm",
                activeInteraction === "move" ? "cursor-grabbing" : "cursor-grab"
              )}
              title="Drag preview"
            >
              <Grip className="h-3.5 w-3.5" />
              Move
            </button>

            <div className="relative">
              {resizeHandleConfig.map((handle) => (
                <button
                  key={handle.direction}
                  type="button"
                  onPointerDown={startResizeInteraction(handle.direction)}
                  className={cn(
                    "absolute z-20 h-4 w-4 rounded-full border border-white/30 bg-zinc-950/85 shadow-[0_8px_20px_rgba(0,0,0,0.35)] backdrop-blur-sm",
                    handle.positionClassName,
                    handle.cursorClassName,
                  )}
                  title={`Resize preview ${handle.label}`}
                />
              ))}

              <div className={frameShellClassName}>
                <div
                  className={frameClassName}
                  style={{
                    width: `${frameSize.width}px`,
                    height: `${frameSize.height}px`,
                    minWidth: `${frameSize.width}px`,
                    minHeight: `${frameSize.height}px`,
                  }}
                >
                  <iframe
                    ref={iframeRef}
                    data-preview-frame="true"
                    title="Preview"
                    className="h-full w-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    style={{
                      backgroundColor: "white",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating Device info pill */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center justify-center gap-3 rounded-full border border-zinc-800/80 bg-zinc-900/90 px-4 py-2 text-[11px] text-zinc-400 shadow-2xl backdrop-blur-md z-30 pointer-events-none">
        <span className="font-medium text-zinc-300">{deviceMode.charAt(0).toUpperCase() + deviceMode.slice(1)} • {frameSize.width}×{frameSize.height}</span>
        <span className="hidden md:inline text-zinc-500">Drag background to pan • drag handle to move • drag corners to resize</span>
      </div>
    </div>
  )
}

const resizeHandleConfig: Array<{
  direction: ResizeHandleDirection
  label: string
  positionClassName: string
  cursorClassName: string
}> = [
  {
    direction: "nw",
    label: "from top left",
    positionClassName: "-left-2 -top-2",
    cursorClassName: "cursor-nwse-resize",
  },
  {
    direction: "ne",
    label: "from top right",
    positionClassName: "-right-2 -top-2",
    cursorClassName: "cursor-nesw-resize",
  },
  {
    direction: "sw",
    label: "from bottom left",
    positionClassName: "-bottom-2 -left-2",
    cursorClassName: "cursor-nesw-resize",
  },
  {
    direction: "se",
    label: "from bottom right",
    positionClassName: "-bottom-2 -right-2",
    cursorClassName: "cursor-nwse-resize",
  },
]

// Helper function to get a unique path to an element
function getElementPath(element: HTMLElement): string {
  const path: string[] = []
  let current: HTMLElement | null = element
  const doc = element.ownerDocument
  
  while (current && current !== doc.body && current !== doc.documentElement) {
    let selector = current.tagName.toLowerCase()
    
    if (current.id) {
      selector += `#${CSS.escape(current.id)}`
      path.unshift(selector)
      break
    } else if (current.className && typeof current.className === "string") {
      const classes = current.className.split(" ").filter(Boolean).slice(0, 2)
      if (classes.length > 0) {
        selector += `.${classes.map(c => CSS.escape(c)).join(".")}`
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

function getFrameOuterDimensions(deviceMode: DeviceMode, frameSize: FrameSize): FrameSize {
  const chromeInsets = deviceChromeInsets[deviceMode]

  return {
    width: frameSize.width + chromeInsets.width,
    height: frameSize.height + chromeInsets.height,
  }
}

function getFrameFootprintDimensions(deviceMode: DeviceMode, frameSize: FrameSize): FrameSize {
  const outerDimensions = getFrameOuterDimensions(deviceMode, frameSize)

  return {
    width: outerDimensions.width,
    height: outerDimensions.height + MOVE_HANDLE_CLEARANCE,
  }
}

function getDefaultFrameSize(
  deviceMode: DeviceMode,
  viewportBounds?: DOMRect,
): FrameSize {
  const baseSize = deviceDimensions[deviceMode]

  if (deviceMode !== "tablet" || !viewportBounds) {
    return { ...baseSize }
  }

  const chromeInsets = deviceChromeInsets[deviceMode]
  const availableWidth = Math.max(
    MIN_FRAME_WIDTH,
    viewportBounds.width - CANVAS_FRAME_PADDING * 2 - chromeInsets.width,
  )
  const availableHeight = Math.max(
    MIN_FRAME_HEIGHT,
    viewportBounds.height - CANVAS_FRAME_PADDING * 2 - MOVE_HANDLE_CLEARANCE - chromeInsets.height,
  )
  const scale = Math.min(1, availableWidth / baseSize.width, availableHeight / baseSize.height)

  return {
    width: Math.max(MIN_FRAME_WIDTH, Math.round(baseSize.width * scale)),
    height: Math.max(MIN_FRAME_HEIGHT, Math.round(baseSize.height * scale)),
  }
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
