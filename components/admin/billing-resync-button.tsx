"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BillingResyncButtonProps {
  userId: string
  disabled?: boolean
}

export function BillingResyncButton({ userId, disabled = false }: BillingResyncButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    const reason = window.prompt("Reason for billing resync")?.trim() || ""
    if (reason.length < 3) {
      setError("A short audit reason is required.")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/admin/billing/resync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, reason }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Failed to resync billing")
      }

      router.refresh()
    } catch (resyncError) {
      setError(resyncError instanceof Error ? resyncError.message : "Failed to resync billing")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isLoading}
        className="border-white/10 bg-transparent text-[#D6D8DA] hover:bg-white/[0.03]"
        onClick={handleClick}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        Resync
      </Button>
      {error ? <p className="max-w-48 text-xs text-amber-200">{error}</p> : null}
    </div>
  )
}