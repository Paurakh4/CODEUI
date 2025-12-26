"use client"

import { useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { Clock, RotateCcw, Eye, X, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface Version {
  id: string
  htmlContent: string
  timestamp: Date
  description?: string
}

interface VersionHistoryProps {
  versions: Version[]
  currentVersionId?: string | null
  onRestore: (versionId: string) => void
  onPreview: (version: Version) => void
  trigger?: React.ReactNode
}

export function VersionHistory({
  versions,
  currentVersionId,
  onRestore,
  onPreview,
  trigger,
}: VersionHistoryProps) {
  const [open, setOpen] = useState(false)
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  const sortedVersions = [...versions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const handlePreview = (version: Version) => {
    setPreviewingId(version.id)
    onPreview(version)
  }

  const handleRestore = (versionId: string) => {
    onRestore(versionId)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Clock className="w-4 h-4" />
            History
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[400px] bg-zinc-950 border-zinc-800 p-0">
        <SheetHeader className="p-4 border-b border-zinc-800">
          <SheetTitle className="text-zinc-100 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Version History
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          {sortedVersions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-400 mb-1">No versions yet</p>
              <p className="text-xs text-zinc-600">
                Versions are created when you save your work
              </p>
            </div>
          ) : (
            <div className="p-2">
              {sortedVersions.map((version, index) => {
                const isCurrent = version.id === currentVersionId
                const isPreviewing = version.id === previewingId

                return (
                  <div
                    key={version.id}
                    className={cn(
                      "group relative rounded-lg border transition-colors mb-2",
                      isCurrent
                        ? "bg-purple-500/10 border-purple-500/30"
                        : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                    )}
                  >
                    <div className="p-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-200">
                              Version {sortedVersions.length - index}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-medium bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {formatDistanceToNow(new Date(version.timestamp), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {format(new Date(version.timestamp), "HH:mm:ss")}
                        </span>
                      </div>

                      {/* Description */}
                      {version.description && (
                        <p className="text-xs text-zinc-400 mb-3 line-clamp-2">
                          {version.description}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePreview(version)}
                          className={cn(
                            "flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors",
                            isPreviewing
                              ? "bg-blue-500/20 text-blue-300"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                          )}
                        >
                          <Eye className="w-3 h-3" />
                          {isPreviewing ? "Previewing" : "Preview"}
                        </button>

                        {!isCurrent && (
                          <button
                            onClick={() => handleRestore(version.id)}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 px-2 py-1 rounded transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Timeline connector */}
                    {index < sortedVersions.length - 1 && (
                      <div className="absolute left-6 top-full w-px h-2 bg-zinc-800" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
