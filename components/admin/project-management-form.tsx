"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface ProjectManagementFormProps {
  projectId: string
  initialName: string
  initialEmoji?: string
  initialIsPrivate: boolean
  readOnly?: boolean
  readOnlyReason?: string
}

export function ProjectManagementForm({
  projectId,
  initialName,
  initialEmoji,
  initialIsPrivate,
  readOnly = false,
  readOnlyReason,
}: ProjectManagementFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [emoji, setEmoji] = useState(initialEmoji || "🎨")
  const [visibility, setVisibility] = useState(initialIsPrivate ? "private" : "public")
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const hasChanges = useMemo(() => {
    return (
      name.trim() !== initialName ||
      emoji.trim() !== (initialEmoji || "🎨") ||
      (visibility === "private") !== initialIsPrivate
    )
  }, [emoji, initialEmoji, initialIsPrivate, initialName, name, visibility])

  const validateReason = () => {
    if (reason.trim().length < 3) {
      toast.error("Reason required", {
        description: "Enter a short reason so the audit log explains the change.",
      })
      return false
    }

    return true
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (readOnly) {
      return
    }

    if (!hasChanges) {
      toast.error("No changes to save", {
        description: "Adjust the project metadata or privacy setting first.",
      })
      return
    }

    if (!validateReason()) {
      return
    }

    const payload: Record<string, unknown> = {
      reason: reason.trim(),
    }

    if (name.trim() !== initialName) {
      payload.name = name.trim()
    }

    if (emoji.trim() !== (initialEmoji || "🎨")) {
      payload.emoji = emoji.trim()
    }

    if ((visibility === "private") !== initialIsPrivate) {
      payload.isPrivate = visibility === "private"
    }

    try {
      setIsSaving(true)
      const response = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update project")
      }

      toast.success("Project updated", {
        description: "Project metadata was updated successfully.",
      })
      setReason("")
      router.refresh()
    } catch (error) {
      toast.error("Update failed", {
        description: error instanceof Error ? error.message : "Failed to update project",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (readOnly) {
      return
    }

    if (!validateReason()) {
      return
    }

    const confirmed = window.confirm(
      "Delete this project and its stored checkpoints and uploaded media? This cannot be undone.",
    )

    if (!confirmed) {
      return
    }

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason.trim() }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete project")
      }

      toast.success("Project deleted", {
        description: "Project metadata and stored assets were removed.",
      })
      router.push("/admin/projects")
      router.refresh()
    } catch (error) {
      toast.error("Delete failed", {
        description: error instanceof Error ? error.message : "Failed to delete project",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {readOnlyReason ? (
        <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] px-4 py-3 text-sm text-[#9B9B9F]">
          {readOnlyReason}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1fr_120px]">
        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Project Name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={readOnly || isSaving || isDeleting}
            className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
            maxLength={120}
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Emoji</span>
          <Input
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            disabled={readOnly || isSaving || isDeleting}
            className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
            maxLength={16}
          />
        </label>
      </div>

      <label className="space-y-1.5 text-sm">
        <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Visibility</span>
        <select
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as "public" | "private")}
          disabled={readOnly || isSaving || isDeleting}
          className="h-10 w-full rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] outline-none transition-colors focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </label>

      <label className="space-y-1.5 text-sm">
        <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Audit Reason</span>
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={readOnly || isSaving || isDeleting}
          className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9] placeholder:text-[#9B9B9F]/50"
          placeholder="Why are you changing this project?"
        />
      </label>

      <div className="flex flex-col gap-4 rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#E7E7E9]">Project controls</p>
            <p className="mt-1 text-sm text-[#9B9B9F]">
              Metadata changes are applied immediately and written to the admin audit log.
            </p>
          </div>
          <Button
            type="submit"
            disabled={readOnly || isSaving || isDeleting || !hasChanges}
            className="rounded-lg bg-[#E7E7E9] text-[#0E0E10] hover:bg-white"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Project
          </Button>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.04] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#E7E7E9]">Danger zone</p>
            <p className="mt-1 text-sm text-[#9B9B9F]">
              Deleting a project removes stored checkpoints and uploaded media for that workspace.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={readOnly || isSaving || isDeleting}
            className="rounded-lg"
            onClick={handleDelete}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete Project
          </Button>
        </div>
      </div>
    </form>
  )
}