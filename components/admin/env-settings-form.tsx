"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { EnvSettingView } from "@/lib/admin/env-settings"

interface EnvSettingsFormProps {
  settings: EnvSettingView[]
  readOnly?: boolean
  readOnlyReason?: string
}

type FieldValue = { touched: boolean; value: string }

export function EnvSettingsForm({
  settings,
  readOnly = false,
  readOnlyReason,
}: EnvSettingsFormProps) {
  const router = useRouter()
  const grouped = useMemo(() => groupBy(settings, (s) => s.group), [settings])
  const groupNames = useMemo(() => Object.keys(grouped), [grouped])
  const [activeTab, setActiveTab] = useState(0)

  const [fields, setFields] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(
      settings.map((s) => [s.key, { touched: false, value: "" }]),
    ),
  )
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = useMemo(
    () => Object.values(fields).some((f) => f.touched && f.value !== ""),
    [fields],
  )

  function updateField(key: string, value: string) {
    if (readOnly || isSaving) return
    setFields((prev) => ({ ...prev, [key]: { touched: true, value } }))
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (readOnly) return

    const changes: Record<string, string> = {}
    for (const [key, field] of Object.entries(fields)) {
      if (field.touched && field.value !== "") {
        changes[key] = field.value
      }
    }

    if (Object.keys(changes).length === 0) {
      setError("Change at least one field before saving.")
      return
    }
    if (reason.trim().length < 3) {
      setError("Enter a short reason so the audit trail is clear.")
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      const response = await fetch("/api/admin/env-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, reason: reason.trim() }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to update settings")

      setReason("")
      setFields(
        Object.fromEntries(
          settings.map((s) => [s.key, { touched: false, value: "" }]),
        ),
      )
      router.refresh()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to update settings",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {readOnlyReason ? (
        <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] px-4 py-3 text-sm text-[#9B9B9F]">
          {readOnlyReason}
        </div>
      ) : null}

      {groupNames.length > 1 ? (
        <div className="flex flex-wrap gap-2 border-b border-white/[0.04] pb-px">
          {groupNames.map((name, idx) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm transition-colors",
                activeTab === idx
                  ? "border-white/20 text-[#E7E7E9]"
                  : "border-transparent text-[#9B9B9F] hover:text-[#E7E7E9]",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {Object.entries(grouped).map(([group, items], idx) => (
        <div key={group} className={cn("space-y-4", activeTab !== idx && "hidden")}>
          <div className="grid gap-4">
            {items.map((setting) => (
              <div key={setting.key} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {setting.hasValue ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500/70" />
                    )}
                    <Label htmlFor={setting.key} className="text-sm">
                      {setting.label}
                    </Label>
                  </div>
                  <span className="text-[11px] text-[#9B9B9F]">
                    {setting.hasValue ? (
                      <span className="font-mono">{setting.masked}</span>
                    ) : (
                      "not set"
                    )}
                  </span>
                </div>
                <Input
                  id={setting.key}
                  type={setting.type === "secret" ? "password" : "text"}
                  inputMode={setting.type === "number" ? "numeric" : undefined}
                  placeholder={
                    setting.type === "secret"
                      ? setting.hasValue
                        ? "Enter a new value to replace"
                        : "Paste value"
                      : setting.masked || String(setting.min ?? "")
                  }
                  value={fields[setting.key]?.value ?? ""}
                  onChange={(e) => updateField(setting.key, e.target.value)}
                  disabled={readOnly || isSaving}
                  autoComplete="off"
                  className="rounded-xl font-mono text-sm"
                />
                <p className="text-xs text-[#9B9B9F]">{setting.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="grid gap-1.5">
        <Label htmlFor="env-settings-reason" className="text-sm">
          Reason
        </Label>
        <Textarea
          id="env-settings-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={readOnly || isSaving}
          placeholder="Why is this change being made? (visible in the audit log)"
          rows={2}
          className="rounded-xl text-sm"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={readOnly || isSaving || !hasChanges}
          className="rounded-xl"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Save changes
        </Button>
        <p className="text-xs text-[#9B9B9F]">
          Writes to <code>.env.local</code> and applies live. Secrets are masked
          in the audit log.
        </p>
      </div>
    </form>
  )
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
      ; (out[k] ??= []).push(item)
  }
  return out
}
