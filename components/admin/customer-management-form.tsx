"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
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
      toast.error("No changes to save", {
        description: "Adjust a role, status, tier, credit field, or note before saving.",
      })
      return
    }

    const monthlyCreditsValue = Number(monthlyCredits)
    const topupCreditsValue = Number(topupCredits)

    if (!Number.isInteger(monthlyCreditsValue) || monthlyCreditsValue < 0) {
      toast.error("Invalid monthly credits", {
        description: "Monthly credits must be a non-negative whole number.",
      })
      return
    }

    if (!Number.isInteger(topupCreditsValue) || topupCreditsValue < 0) {
      toast.error("Invalid top-up credits", {
        description: "Top-up credits must be a non-negative whole number.",
      })
      return
    }

    if (reason.trim().length < 3) {
      toast.error("Reason required", {
        description: "Enter a short reason so the change is clear in the audit log.",
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

      toast.success("Customer updated", {
        description: "Role, status, tier, or credits were updated successfully.",
      })
      setReason("")
      router.refresh()
    } catch (error) {
      toast.error("Update failed", {
        description: error instanceof Error ? error.message : "Failed to update customer",
      })
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

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            disabled={readOnly || isSaving}
            className="h-10 w-full rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] outline-none transition-colors focus-visible:border-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {availableRoles.map((value) => (
              <option key={value} value={value}>
                {formatRoleLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Account Status</span>
          <select
            value={accountStatus}
            onChange={(event) => setAccountStatus(event.target.value as AccountStatus)}
            disabled={readOnly || isSaving}
            className="h-10 w-full rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] outline-none transition-colors focus-visible:border-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accountStatuses.map((value) => (
              <option key={value} value={value}>
                {formatRoleLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Subscription Tier</span>
          <select
            value={subscriptionTier}
            onChange={(event) => setSubscriptionTier(event.target.value as SubscriptionTier)}
            disabled={readOnly || isSaving}
            className="h-10 w-full rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] outline-none transition-colors focus-visible:border-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {subscriptionTiers.map((value) => (
              <option key={value} value={value}>
                {formatTierLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Monthly Credits</span>
          <Input
            type="number"
            min={0}
            step={1}
            value={monthlyCredits}
            onChange={(event) => setMonthlyCredits(event.target.value)}
            disabled={readOnly || isSaving}
            className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Top-up Credits</span>
          <Input
            type="number"
            min={0}
            step={1}
            value={topupCredits}
            onChange={(event) => setTopupCredits(event.target.value)}
            disabled={readOnly || isSaving}
            className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9]"
          />
        </label>
      </div>

      <label className="space-y-1.5 text-sm">
        <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Admin Notes</span>
        <Textarea
          value={adminNotes}
          onChange={(event) => setAdminNotes(event.target.value)}
          disabled={readOnly || isSaving}
          className="min-h-28 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9] placeholder:text-[#9B9B9F]/50"
          placeholder="Internal notes about this customer account"
        />
      </label>

      <label className="space-y-1.5 text-sm">
        <span className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">Audit Reason</span>
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={readOnly || isSaving}
          className="h-10 rounded-lg border border-white/[0.04] bg-[#0E0E10] text-[#E7E7E9] placeholder:text-[#9B9B9F]/50"
          placeholder="Why are you making this change?"
        />
      </label>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[#9B9B9F]">
          Changes are written to the admin audit log and applied immediately.
        </p>

        <Button
          type="submit"
          disabled={readOnly || isSaving || !hasChanges}
          className="rounded-lg bg-[#E7E7E9] text-[#0E0E10] hover:bg-white"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Customer
        </Button>
      </div>
    </form>
  )
}