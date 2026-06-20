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
  ArrowRight,
  Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { motion } from "framer-motion"
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
  badge?: string
}>> = {
  pro: {
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    badge: "Most Popular",
  },
  proplus: {
    icon: Crown,
    color: "text-sky-400",
    bg: "bg-sky-400/10",
  },
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

const easeSmooth = [0.23, 1, 0.32, 1] as const

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay: i * 0.08,
      ease: easeSmooth,
    },
  }),
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
      badge: style?.badge,
    }
  })

  const visibleTopupPackages = topupPackages.length > 0
    ? topupPackages
    : TOPUP_PACKAGES.map((pkg) => ({ ...pkg, available: false }))

  const topupDescriptions: Record<string, string> = {
    topup_25: "Perfect for a quick boost of extra generations.",
    topup_50: "Great for occasional extra runs between cycles.",
    topup_100: "Best value — the most credits per dollar.",
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose()
      }
    }}>
      <DialogContent className="w-[95vw] sm:max-w-5xl md:w-[80vw] border-white/[0.04] bg-[#0A0A0C] p-0 text-white sm:rounded-2xl">
        <div className="px-4 py-4 sm:px-6 sm:py-6 overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-white/[0.06]">
          <DialogHeader className="items-start text-left">
            <DialogTitle className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Choose your plan
            </DialogTitle>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9B9B9F]">
              Upgrade when you need more monthly credits, private projects, and priority access. Live pricing is pulled directly from Stripe.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex gap-1 p-1 bg-[#0E0E10] border border-white/[0.04] rounded-xl" role="radiogroup" aria-label="Billing cycle">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={cn(
                    "whitespace-nowrap px-5 py-2 rounded-lg text-sm font-medium transition-all",
                    billingCycle === "monthly"
                      ? "bg-[#1B1B1F] text-[#E7E7E9]"
                      : "text-[#6B6B70] hover:text-[#9B9B9F]"
                  )}
                  role="radio"
                  aria-checked={billingCycle === "monthly"}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  disabled={!hasYearlyPlans}
                  className={cn(
                    "whitespace-nowrap px-5 py-2 rounded-lg text-sm font-medium transition-all",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    billingCycle === "yearly"
                      ? "bg-[#1B1B1F] text-[#E7E7E9]"
                      : "text-[#6B6B70] hover:text-[#9B9B9F]"
                  )}
                  role="radio"
                  aria-checked={billingCycle === "yearly"}
                >
                  Yearly
                  {hasYearlyPlans && (
                    <span className="ml-1.5 text-[10px] font-semibold text-emerald-400">Save ~17%</span>
                  )}
                </button>
              </div>

              <div className={cn("flex items-center gap-2 rounded-full border border-white/[0.06] bg-[#0E0E10] px-4 py-1.5", isPricingLoading && "animate-pulse")}>
                <Lock className="h-3 w-3 text-[#6B6B70]" />
                <span className="text-[11px] text-[#6B6B70]">
                  {isPricingLoading ? "Syncing with Stripe..." : "Secured by Stripe"}
                </span>
              </div>
            </div>

            {billingCycle === "yearly" && (
              <div className="mt-3 text-xs text-[#6B6B70]">
                Annual plans renew yearly. Monthly credits still reset every billing cycle.
              </div>
            )}

            {pricingIssues.length > 0 && (
              <div className="mt-4 max-w-xl rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                Some Stripe plans are currently unavailable. Only plans with configured live Stripe prices can be purchased.
              </div>
            )}
          </DialogHeader>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((plan, index) => {
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
                <motion.div
                  key={plan.id}
                  custom={index}
                  initial="hidden"
                  animate="visible"
                  variants={cardVariants}
                  whileHover={{ y: -2, transition: { duration: 0.2, ease: "easeOut" } }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "relative flex flex-col rounded-2xl p-5",
                    plan.badge && [
                      "bg-[#0E0E10]",
                      "shadow-[0_0_0_1px_rgba(251,191,36,0.15),0_4px_24px_-8px_rgba(0,0,0,0.5),0_0_32px_-12px_rgba(251,191,36,0.1)]",
                      "scale-[1.02] z-10",
                    ],
                    !plan.badge && plan.id === "proplus" && [
                      "border border-white/[0.06] bg-[#0E0E10]",
                      "shadow-[0_4px_20px_-8px_rgba(0,0,0,0.4)]",
                    ],
                    plan.id === "free" && [
                      "border border-white/[0.04] bg-[#0E0E10]",
                    ],
                  )}
                >
                  {plan.badge && (
                    <>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-amber-500/20 blur-xl rounded-full" />
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#E7E7E9] px-4 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#0A0A0C] shadow-none">
                        {plan.badge}
                      </div>
                    </>
                  )}

                  <div className={cn("mb-5", plan.badge && "mt-4")}>
                    <div className="mb-3 flex items-center gap-3">
                      {Icon && plan.bg && plan.color && (
                        <div className={cn("rounded-xl p-2", plan.bg)}>
                          <Icon className={cn("h-5 w-5", plan.color)} />
                        </div>
                      )}
                      <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold tracking-tight text-white">{price}</span>
                      {plan.id !== "free" && (
                        <span className="text-sm text-[#6B6B70]">
                          /{billingCycle === "monthly" ? "month" : "year"}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[#9B9B9F]">
                      {plan.description}
                    </p>
                    <p className="mt-2 text-xs text-[#6B6B70]">{sublabel}</p>
                  </div>

                  <div className="mb-6 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <div className={cn(
                          "mt-0.5 rounded-full p-0.5 flex-shrink-0",
                          plan.badge ? "bg-amber-500/20" : "bg-[#1B1B1F]"
                        )}>
                          <Check className={cn(
                            "h-3 w-3",
                            plan.badge ? "text-amber-400" : "text-[#E7E7E9]"
                          )} />
                        </div>
                        <span className="text-sm leading-tight text-[#E7E7E9]">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant={plan.badge ? "default" : "outline"}
                    className={cn(
                      "w-full rounded-xl text-sm font-semibold",
                      plan.badge
                        ? "border-none bg-[#E7E7E9] text-[#0A0A0C] hover:bg-white shadow-[0_4px_20px_-8px_rgba(255,255,255,0.15)]"
                        : "border-white/[0.08] text-[#E7E7E9] hover:bg-[#1B1B1F] hover:border-white/[0.12]"
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
                      <ArrowRight className="ml-2 h-4 w-4" />
                    )}
                  </Button>
                </motion.div>
              )
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-white/[0.04] bg-[#0E0E10] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">Need extra credits?</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9B9B9F]">
                  Buy a one-time credit pack when you need extra generations. Top-up credits do not expire with your monthly billing cycle.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6B6B70]">
                <Lock className="h-3 w-3" />
                {isTopupLoading ? "Loading..." : "One-time purchases via Stripe"}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {visibleTopupPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="group rounded-2xl border border-white/[0.04] bg-[#0E0E10] p-5 transition-colors hover:border-white/[0.08] hover:bg-[#1B1B1F]"
                >
                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6B6B70]">
                    Credit Pack
                  </div>
                  <div className="mt-4 text-3xl font-bold tracking-tight text-white">
                    {pkg.credits}
                    <span className="ml-1 text-lg font-normal text-[#6B6B70]">credits</span>
                  </div>
                  <p className="mt-2 text-sm text-[#9B9B9F]">
                    {formatCurrency(pkg.price, "usd")} one-time
                  </p>
                  <p className="mt-4 text-xs leading-relaxed text-[#6B6B70]">
                    {topupDescriptions[pkg.id] ?? "Extra credits without changing your plan."}
                  </p>

                  <Button
                    variant="outline"
                    className="mt-6 w-full rounded-xl border-white/[0.08] text-[#E7E7E9] hover:bg-[#1B1B1F] hover:border-white/[0.12]"
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
                    {isLoading !== pkg.id && pkg.available && <ArrowRight className="ml-2 h-4 w-4" />}
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
