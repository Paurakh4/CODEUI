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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  PAID_SUBSCRIPTION_TIERS,
  TOPUP_PACKAGES,
  TIERS,
  type BillingCycle,
  type PaidSubscriptionTier,
  type StripePricingQuote,
  type SubscriptionTier,
  type TopupPackage,
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

type PricingAvailability = Record<
  PaidSubscriptionTier,
  Record<BillingCycle, boolean>
>

type TopupOption = TopupPackage & {
  available: boolean
}

async function getResponseError(response: Response, fallbackMessage: string) {
  const message = (await response.text()).trim()
  return message || fallbackMessage
}

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
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>("monthly")
  const [pricing, setPricing] = React.useState<PricingResponse | null>(null)
  const [availability, setAvailability] = React.useState<PricingAvailability | null>(null)
  const [topupPackages, setTopupPackages] = React.useState<TopupOption[]>([])
  const [isPricingLoading, setIsPricingLoading] = React.useState(false)
  const [isTopupLoading, setIsTopupLoading] = React.useState(false)
  const [pricingIssues, setPricingIssues] = React.useState<string[]>([])

  React.useEffect(() => {
    if (!isOpen) {
      return
    }

    const controller = new AbortController()

    const loadPricing = async () => {
      try {
        setIsPricingLoading(true)
        const pricingResponse = await fetch("/api/stripe/pricing", {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!pricingResponse.ok) {
          throw new Error(await getResponseError(pricingResponse, "Failed to load Stripe pricing"))
        }

        const data = await pricingResponse.json() as {
          prices?: PricingResponse
          availability?: PricingAvailability
          issues?: string[]
        }

        setPricing(data.prices ?? null)
        setAvailability(data.availability ?? null)
        setPricingIssues(data.issues ?? [])

        if (data.issues?.length) {
          toast.error("Some Stripe pricing options are unavailable right now.")
          console.error("STRIPE_PRICING_ISSUES", data.issues)
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error)
          toast.error(error instanceof Error ? error.message : "Unable to load live Stripe pricing.")
        }
      } finally {
        setIsPricingLoading(false)
      }
    }

    const loadTopupPackages = async () => {
      try {
        setIsTopupLoading(true)
        const topupResponse = await fetch("/api/stripe/topup", {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!topupResponse.ok) {
          throw new Error(await getResponseError(topupResponse, "Failed to load top-up packages"))
        }

        const data = await topupResponse.json() as {
          packages?: TopupOption[]
        }

        setTopupPackages(data.packages ?? [])
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error)
          toast.error(error instanceof Error ? error.message : "Unable to load top-up packages.")
        }
      } finally {
        setIsTopupLoading(false)
      }
    }

    void loadPricing()
    void loadTopupPackages()

    return () => controller.abort()
  }, [isOpen])

  const hasYearlyPlans = availability
    ? PAID_SUBSCRIPTION_TIERS.some((tier) => availability[tier]?.yearly)
    : true

  React.useEffect(() => {
    if (billingCycle === "yearly" && !hasYearlyPlans) {
      setBillingCycle("monthly")
    }
  }, [billingCycle, hasYearlyPlans])

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
        throw new Error(await getResponseError(response, "Failed to create Stripe checkout session"))
      }

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
        return
      }

      throw new Error("Stripe checkout session did not return a redirect URL")
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.")
    } finally {
      setIsLoading(null)
    }
  }

  const onTopupCheckout = async (packageId: TopupPackage["id"]) => {
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
        throw new Error(await getResponseError(response, "Failed to create Stripe top-up session"))
      }

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
        return
      }

      throw new Error("Stripe top-up session did not return a redirect URL")
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.")
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
    const isConfiguredForCycle = isPaidTier
      ? availability
        ? Boolean(availability[planId]?.[billingCycle])
        : true
      : true

    return {
      id: planId,
      name: tier.name,
      description: tier.description,
      features: tier.features,
      amount,
      currency,
      yearlySavings,
      isCurrentTier,
      isConfiguredForCycle,
      icon: style?.icon,
      color: style?.color,
      bg: style?.bg,
      border: style?.border,
      badge: style?.badge,
    }
  })

  const visibleTopupPackages = topupPackages.length > 0
    ? topupPackages
    : TOPUP_PACKAGES.map((pkg) => ({ ...pkg, available: false }))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose()
      }
    }}>
      <DialogContent className="w-[95vw] sm:max-w-5xl md:w-[80vw] border-white/10 bg-[#050506] p-0 text-white sm:rounded-3xl">
        <div className="px-6 py-6 sm:px-8 sm:py-8 overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-white/10">
          <DialogHeader className="items-start text-left">
            <DialogTitle className="text-3xl font-semibold tracking-tight text-white">
              Choose your plan
            </DialogTitle>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Upgrade when you need more monthly credits, private projects, and priority access. Live pricing is pulled directly from Stripe.
            </p>

            <div className="flex flex-wrap items-center gap-3">
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
                  disabled={!hasYearlyPlans}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
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

            {pricingIssues.length > 0 && (
              <div className="mt-4 max-w-xl rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-200">
                Some Stripe plans are currently unavailable. Only plans with configured live Stripe prices can be purchased.
              </div>
            )}
          </DialogHeader>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon
              const price = plan.id === "free" ? "$0" : formatCurrency(plan.amount, plan.currency)
              const sublabel = plan.id === "free"
                ? "No credit card required"
                : !plan.isConfiguredForCycle
                  ? "Not configured in Stripe yet"
                  : billingCycle === "monthly"
                    ? "Billed monthly"
                    : `Billed annually${plan.yearlySavings > 0 ? ` · Save ${formatCurrency(plan.yearlySavings, plan.currency)}` : ""}`

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border p-6 transition-all duration-300",
                    plan.badge
                      ? "z-10 scale-[1.02] border-white/20 bg-zinc-900 shadow-2xl"
                      : plan.border
                        ? `bg-black ${plan.border} hover:border-white/30`
                        : "border-white/5 bg-black hover:border-white/10"
                  )}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                      {plan.badge}
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="mb-2 flex items-center gap-2">
                      {Icon && plan.bg && plan.color && (
                        <div className={cn("rounded-lg p-1.5", plan.bg)}>
                          <Icon className={cn("h-4 w-4", plan.color)} />
                        </div>
                      )}
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{price}</span>
                      {plan.id !== "free" && (
                        <span className="text-sm text-zinc-500">
                          {billingCycle === "monthly" ? "/month" : "/year"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      {plan.description}
                    </p>
                    <p className="mt-2 text-[11px] text-zinc-600">{sublabel}</p>
                  </div>

                  <div className="mb-8 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <div className="mt-1 rounded-full bg-white/10 p-0.5">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span className="text-xs leading-tight text-zinc-400">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant={plan.badge ? "default" : "outline"}
                    className={cn(
                      "w-full rounded-xl py-5 text-xs font-bold transition-all",
                      plan.badge
                        ? "border-none bg-white text-black hover:bg-zinc-200"
                        : "border-white/20 bg-transparent text-white hover:border-white/30 hover:bg-white/5"
                    )}
                    disabled={plan.id === "free" || plan.isCurrentTier || isLoading !== null || !plan.isConfiguredForCycle}
                    onClick={() => {
                      if (plan.id !== "free" && plan.isConfiguredForCycle) {
                        void onCheckout(plan.id)
                      }
                    }}
                  >
                    {plan.isCurrentTier
                      ? "Current Plan"
                      : isLoading === plan.id
                        ? "Processing..."
                        : !plan.isConfiguredForCycle
                          ? "Unavailable"
                          : plan.id === "free"
                            ? "Included"
                            : `Upgrade to ${plan.name}`}
                    {!plan.isCurrentTier && plan.id !== "free" && isLoading !== plan.id && plan.isConfiguredForCycle && (
                      <ArrowRight className="ml-2 h-3 w-3" />
                    )}
                  </Button>
                </div>
              )
            })}
          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-950/80 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Need extra credits?</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
                  Buy a one-time credit pack when you need extra generations. Top-up credits do not expire with your monthly billing cycle.
                </p>
              </div>
              <div className="text-[11px] text-zinc-500">
                {isTopupLoading ? "Loading top-up packages..." : "One-time purchases via Stripe"}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {visibleTopupPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-2xl border border-white/10 bg-black/60 p-5"
                >
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                    Credit Pack
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-white">
                    {pkg.credits} credits
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    {formatCurrency(pkg.price, "usd")} one-time purchase
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                    Best for occasional extra runs without changing your subscription.
                  </p>

                  <Button
                    variant="outline"
                    className="mt-5 w-full rounded-xl border-white/20 bg-transparent text-white hover:border-white/30 hover:bg-white/5"
                    disabled={isLoading !== null || !pkg.available}
                    onClick={() => {
                      if (pkg.available) {
                        void onTopupCheckout(pkg.id)
                      }
                    }}
                  >
                    {isLoading === pkg.id
                      ? "Processing..."
                      : pkg.available
                        ? "Buy top-up"
                        : "Unavailable"}
                    {isLoading !== pkg.id && pkg.available && <ArrowRight className="ml-2 h-3 w-3" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
