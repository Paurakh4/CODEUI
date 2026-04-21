"use client"

import * as React from "react"

const DESKTOP_PREVIEW_WIDTH = 1440
const DESKTOP_PREVIEW_HEIGHT = 900

interface PublicProjectPreviewProps {
  htmlContent: string
  title: string
  className?: string
}

export function PublicProjectPreview({ htmlContent, title, className }: PublicProjectPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = React.useState(0.1)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScale = () => {
      const { width, height } = container.getBoundingClientRect()
      if (width <= 0 || height <= 0) return

      const nextScale = Math.min(
        width / DESKTOP_PREVIEW_WIDTH,
        height / DESKTOP_PREVIEW_HEIGHT,
      )

      setPreviewScale((currentScale) =>
        Math.abs(currentScale - nextScale) < 0.001 ? currentScale : nextScale,
      )
    }

    updateScale()

    const observer = new ResizeObserver(() => {
      updateScale()
    })

    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={className || "relative overflow-hidden bg-black"}>
      <div
        className="absolute left-1/2 top-0 origin-top"
        style={{
          width: DESKTOP_PREVIEW_WIDTH,
          height: DESKTOP_PREVIEW_HEIGHT,
          transform: `translateX(-50%) scale(${previewScale})`,
        }}
      >
        <iframe
          title={title}
          srcDoc={htmlContent}
          sandbox="allow-scripts"
          loading="lazy"
          tabIndex={-1}
          className="block h-full w-full border-0 bg-white pointer-events-none"
        />
      </div>
    </div>
  )
}
