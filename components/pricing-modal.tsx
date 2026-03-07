"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { 
  Check, 
  Zap, 
  Crown,
  Sparkles,
  ArrowRight,
  Plus
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  TOPUP_PACKAGES,
  TIERS,
  type BillingCycle,
  type PaidSubscriptionTier,
  type StripePricingQuote,
  type SubscriptionTier,
} from "@/lib/pricing"

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
  currentTier?: SubscriptionTier
}

type PricingResponse = Record<
  PaidSubscriptionTier,
  Partial<Record<BillingCycle, StripePricingQuote>>
>

const PLAN_ORDER: SubscriptionTier[] = ["free", "pro", "proplus"]

const PLAN_STYLES: Partial<Record<PaidSubscriptionTier, {
  icon: typeof Zap
  color: string
  bg: string
  border: string
  badge?: string
}>> = {
  pro: {
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    badge: "Most Popular",
  },
  proplus: {
    icon: Crown,
    color: "text-sky-400",
    bg: "bg-sky-400/10",
    border: "border-sky-400/20",
  },
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

export function PricingModal({ isOpen, onClose, currentTier = "free" }: PricingModalProps) {
  const [isLoading, setIsLoading] = React.useState<string | null>(null)
  const [showTopups, setShowTopups] = React.useState(false)
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>("monthly")
  const [pricing, setPricing] = React.useState<PricingResponse | null>(null)
  const [isPricingLoading, setIsPricingLoading] = React.useState(false)

  React.useEffect(() => {
    if (!isOpen) {
      return
    }

    const controller = new AbortController()

    const loadPricing = async () => {
      try {
        setIsPricingLoading(true)
        const response = await fetch("/api/stripe/pricing", {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Failed to load Stripe pricing")
        }

        const data = await response.json() as { prices?: PricingResponse }
        setPricing(data.prices ?? null)
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error)
          toast.error("Unable to load live Stripe pricing. Showing fallback prices.")
        }
      } finally {
        setIsPricingLoading(false)
      }
    }

    void loadPricing()

    return () => controller.abort()
  }, [isOpen])

  const onCheckout = async (tier: PaidSubscriptionTier) => {
    try {
      setIsLoading(tier)
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tier, billingCycle }),
      })

      if (!response.ok) {
        throw new Error("Failed to create Stripe checkout session")
      }

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error(error)
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsLoading(null)
    }
  }

  const onTopupCheckout = async (packageId: string) => {
    try {
      setIsLoading(packageId)
      const response = await fetch("/api/stripe/topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packageId }),
      })

      if (!response.ok) {
        throw new Error("Failed to create Stripe top-up session")
      }

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error(error)
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsLoading(null)
    }
  }

  const plans = PLAN_ORDER.map((planId) => {
    const tier = TIERS[planId]
    const livePricing = planId === "free" ? undefined : pricing?.[planId]?.[billingCycle]
    const currency = livePricing?.currency ?? "usd"
    const fallbackAmount = billingCycle === "monthly" ? tier.priceMonthly : tier.priceYearly ?? tier.priceMonthly * 10
    const amount = livePricing?.amount ?? fallbackAmount
    const yearlySavings = billingCycle === "yearly" ? Math.max(0, tier.priceMonthly * 12 - amount) : 0
    const isCurrentTier = currentTier === planId
    const isPaidTier = planId !== "free"
    const style = isPaidTier ? PLAN_STYLES[planId] : undefined

    return {
      id: planId,
      name: tier.name,
      description: tier.description,
      features: tier.features,
      amount,
      currency,
      isCurrentTier,
      isPaidTier,
      yearlySavings,
      icon: style?.icon,
      color: style?.color,
      bg: style?.bg,
      border: style?.border,
      badge: style?.badge,
    }
  })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] bg-zinc-950 border-white/10 text-zinc-100 p-0 max-h-[90vh] overflow-hidden outline-none">
        <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="flex flex-col items-center text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pricing Plans</span>
              </div>
            </div>
            <DialogTitle className="text-3xl font-bold tracking-tight mb-2 text-white text-center">Upgrade your creative power</DialogTitle>
            <p className="text-zinc-400 max-w-md mx-auto text-center mb-6">
              Choose the plan that's right for you and start building amazing UIs with CodeUI.
            </p>

            <div className="flex items-center gap-3">
              <div className="flex p-1 bg-white/5 rounded-lg border border-white/10">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                    billingCycle === "monthly"
                      ? "bg-white text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                    billingCycle === "yearly"
                      ? "bg-white text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  Yearly
                </button>
              </div>
              <div className="text-[11px] text-zinc-500">
                {isPricingLoading ? "Syncing with Stripe..." : "Stripe-only billing"}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Live plan pricing is loaded directly from Stripe.
            </div>

            {billingCycle === "yearly" && (
              <div className="mt-3 text-[11px] text-zinc-500">
                Annual plans renew yearly while monthly credits still reset every billing cycle.
              </div>
            )}
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const Icon = plan.icon
              const price = plan.id === "free" ? "$0" : formatCurrency(plan.amount, plan.currency)
              const sublabel = plan.id === "free"
                ? "No credit card required"
                : billingCycle === "monthly"
                  ? "Billed monthly"
                  : `Billed annually${plan.yearlySavings > 0 ? ` · Save ${formatCurrency(plan.yearlySavings, plan.currency)}` : ""}`

              return (
                <div 
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col p-6 rounded-2xl border transition-all duration-300",
                    plan.badge
                      ? "bg-zinc-900 border-white/20 shadow-2xl scale-[1.02] z-10"
                      : plan.border
                        ? `bg-black ${plan.border} hover:border-white/30`
                        : "bg-black border-white/5 hover:border-white/10"
                  )}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      {plan.badge}
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      {Icon && plan.bg && plan.color && (
                        <div className={cn("p-1.5 rounded-lg", plan.bg)}>
                          <Icon className={cn("w-4 h-4", plan.color)} />
                        </div>
                      )}
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{price}</span>
                      {plan.id !== "free" && (
                        <span className="text-zinc-500 text-sm">
                          {billingCycle === "monthly" ? "/month" : "/year"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                      {plan.description}
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-2">{sublabel}</p>
                  </div>

                  <div className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <div className="mt-1 bg-white/10 rounded-full p-0.5">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                        <span className="text-xs text-zinc-400 leading-tight">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button 
                    variant={plan.badge ? "default" : "outline"}
                    className={cn(
                      "w-full rounded-xl py-5 text-xs font-bold transition-all",
                      plan.badge
                        ? "bg-white text-black hover:bg-zinc-200 border-none"
                        : "bg-transparent border-white/20 text-white hover:bg-white/5 hover:border-white/30"
                    )}
                    disabled={plan.id === "free" || plan.isCurrentTier || isLoading !== null}
                    onClick={() => {
                      if (plan.id !== "free") {
                        void onCheckout(plan.id)
                      }
                    }}
                  >
                    {plan.isCurrentTier
                      ? "Current Plan"
                      : isLoading === plan.id
                        ? "Processing..."
                        : plan.id === "free"
                          ? "Included"
                          : `Upgrade to ${plan.name}`}
                    {!plan.isCurrentTier && plan.id !== "free" && isLoading !== plan.id && <ArrowRight className="w-3 h-3 ml-2" />}
                  </Button>
                </div>
              )
            })}
          </div>

          <div className="mt-10 pt-8 border-t border-white/5">
            <div className="flex flex-col items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => setShowTopups(!showTopups)}
                className="text-xs text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <Plus className="w-3 h-3 mr-2" />
                {showTopups ? "Hide top-up options" : "Need more credits? Buy a top-up"}
              </Button>

              {showTopups && (
                <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                  {TOPUP_PACKAGES.map((pkg) => {
                    return (
                      <div
                        key={pkg.id}
                        className="flex flex-col items-center p-4 rounded-xl border border-white/10 bg-zinc-900/50 hover:border-white/20 transition-all"
                      >
                        <div className="flex items-center gap-1 mb-2">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span className="text-lg font-bold text-white">{pkg.credits}</span>
                        </div>
                        <span className="text-xs text-zinc-500 mb-3">credits</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs border-white/20 hover:bg-white/5"
                          disabled={isLoading !== null}
                          onClick={() => void onTopupCheckout(pkg.id)}
                        >
                          {isLoading === pkg.id ? "..." : formatCurrency(pkg.price, "usd")}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
