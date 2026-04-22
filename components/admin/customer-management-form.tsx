"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { AccountStatus, UserRole } from "@/lib/admin/rbac"
import type { SubscriptionTier } from "@/lib/pricing"

interface CustomerManagementFormProps {
  userId: string
  initialRole: UserRole
  initialAccountStatus: AccountStatus
  initialSubscriptionTier: SubscriptionTier
  initialMonthlyCredits: number
  initialTopupCredits: number
  initialAdminNotes: string
  availableRoles: readonly UserRole[]
  readOnly?: boolean
  readOnlyReason?: string
}

const accountStatuses: AccountStatus[] = ["active", "suspended"]
const subscriptionTiers: SubscriptionTier[] = ["free", "pro", "proplus"]

function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function formatTierLabel(tier: SubscriptionTier) {
  if (tier === "proplus") {
    return "Pro Plus"
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

export function CustomerManagementForm({
  userId,
  initialRole,
  initialAccountStatus,
  initialSubscriptionTier,
  initialMonthlyCredits,
  initialTopupCredits,
  initialAdminNotes,
  availableRoles,
  readOnly = false,
  readOnlyReason,
}: CustomerManagementFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [role, setRole] = useState(initialRole)
  const [accountStatus, setAccountStatus] = useState(initialAccountStatus)
  const [subscriptionTier, setSubscriptionTier] = useState(initialSubscriptionTier)
  const [monthlyCredits, setMonthlyCredits] = useState(String(initialMonthlyCredits))
  const [topupCredits, setTopupCredits] = useState(String(initialTopupCredits))
  const [adminNotes, setAdminNotes] = useState(initialAdminNotes)
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setRole(initialRole)
    setAccountStatus(initialAccountStatus)
    setSubscriptionTier(initialSubscriptionTier)
    setMonthlyCredits(String(initialMonthlyCredits))
    setTopupCredits(String(initialTopupCredits))
    setAdminNotes(initialAdminNotes)
  }, [
    initialAccountStatus,
    initialAdminNotes,
    initialMonthlyCredits,
    initialRole,
    initialSubscriptionTier,
    initialTopupCredits,
  ])

  const hasChanges = useMemo(() => {
    return (
      role !== initialRole ||
      accountStatus !== initialAccountStatus ||
      subscriptionTier !== initialSubscriptionTier ||
      Number(monthlyCredits) !== initialMonthlyCredits ||
      Number(topupCredits) !== initialTopupCredits ||
      adminNotes.trim() !== initialAdminNotes.trim()
    )
  }, [
    accountStatus,
    adminNotes,
    initialAccountStatus,
    initialAdminNotes,
    initialMonthlyCredits,
    initialRole,
    initialSubscriptionTier,
    initialTopupCredits,
    monthlyCredits,
    role,
    subscriptionTier,
    topupCredits,
  ])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (readOnly) {
      return
    }

    if (!hasChanges) {
      toast({
        title: "No changes to save",
        description: "Adjust a role, status, tier, credit field, or note before saving.",
        variant: "destructive",
      })
      return
    }

    const monthlyCreditsValue = Number(monthlyCredits)
    const topupCreditsValue = Number(topupCredits)

    if (!Number.isInteger(monthlyCreditsValue) || monthlyCreditsValue < 0) {
      toast({
        title: "Invalid monthly credits",
        description: "Monthly credits must be a non-negative whole number.",
        variant: "destructive",
      })
      return
    }

    if (!Number.isInteger(topupCreditsValue) || topupCreditsValue < 0) {
      toast({
        title: "Invalid top-up credits",
        description: "Top-up credits must be a non-negative whole number.",
        variant: "destructive",
      })
      return
    }

    if (reason.trim().length < 3) {
      toast({
        title: "Reason required",
        description: "Enter a short reason so the change is clear in the audit log.",
        variant: "destructive",
      })
      return
    }

    const payload: Record<string, unknown> = {
      reason: reason.trim(),
    }

    if (role !== initialRole) {
      payload.role = role
    }

    if (accountStatus !== initialAccountStatus) {
      payload.accountStatus = accountStatus
    }

    if (subscriptionTier !== initialSubscriptionTier) {
      payload.subscriptionTier = subscriptionTier
    }

    if (monthlyCreditsValue !== initialMonthlyCredits) {
      payload.monthlyCredits = monthlyCreditsValue
    }

    if (topupCreditsValue !== initialTopupCredits) {
      payload.topupCredits = topupCreditsValue
    }

    if (adminNotes.trim() !== initialAdminNotes.trim()) {
      payload.adminNotes = adminNotes.trim()
    }

    try {
      setIsSaving(true)

      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update customer")
      }

      toast({
        title: "Customer updated",
        description: "Role, status, tier, or credits were updated successfully.",
      })
      setReason("")
      router.refresh()
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update customer",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {readOnlyReason ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          {readOnlyReason}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-[#D6D8DA]">
          <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            disabled={readOnly || isSaving}
            className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {availableRoles.map((value) => (
              <option key={value} value={value}>
                {formatRoleLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-[#D6D8DA]">
          <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Account Status</span>
          <select
            value={accountStatus}
            onChange={(event) => setAccountStatus(event.target.value as AccountStatus)}
            disabled={readOnly || isSaving}
            className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accountStatuses.map((value) => (
              <option key={value} value={value}>
                {formatRoleLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-[#D6D8DA]">
          <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Subscription Tier</span>
          <select
            value={subscriptionTier}
            onChange={(event) => setSubscriptionTier(event.target.value as SubscriptionTier)}
            disabled={readOnly || isSaving}
            className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {subscriptionTiers.map((value) => (
              <option key={value} value={value}>
                {formatTierLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-[#D6D8DA]">
          <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Monthly Credits</span>
          <Input
            type="number"
            min={0}
            step={1}
            value={monthlyCredits}
            onChange={(event) => setMonthlyCredits(event.target.value)}
            disabled={readOnly || isSaving}
            className="h-10 rounded-xl border-white/10 bg-[#0B0C0D] text-white"
          />
        </label>

        <label className="space-y-2 text-sm text-[#D6D8DA]">
          <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Top-up Credits</span>
          <Input
            type="number"
            min={0}
            step={1}
            value={topupCredits}
            onChange={(event) => setTopupCredits(event.target.value)}
            disabled={readOnly || isSaving}
            className="h-10 rounded-xl border-white/10 bg-[#0B0C0D] text-white"
          />
        </label>
      </div>

      <label className="space-y-2 text-sm text-[#D6D8DA]">
        <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Admin Notes</span>
        <Textarea
          value={adminNotes}
          onChange={(event) => setAdminNotes(event.target.value)}
          disabled={readOnly || isSaving}
          className="min-h-28 rounded-2xl border-white/10 bg-[#0B0C0D] text-white"
          placeholder="Internal notes about this customer account"
        />
      </label>

      <label className="space-y-2 text-sm text-[#D6D8DA]">
        <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Audit Reason</span>
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={readOnly || isSaving}
          className="h-10 rounded-xl border-white/10 bg-[#0B0C0D] text-white"
          placeholder="Why are you making this change?"
        />
      </label>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[#A6A6A6]">
          Changes are written to the admin audit log and applied immediately.
        </p>

        <Button
          type="submit"
          disabled={readOnly || isSaving || !hasChanges}
          className="rounded-xl bg-[#0AA6FF] text-white hover:bg-[#0AA6FF]/90"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Customer
        </Button>
      </div>
    </form>
  )
}