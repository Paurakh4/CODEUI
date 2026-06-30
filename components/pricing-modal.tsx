"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Check,
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
  badge?: string
}>> = {
  pro: {
    badge: "Most popular",
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
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      delay: i * 0.05,
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
      badge: style?.badge,
    }
  })

  const visibleTopupPackages = topupPackages.length > 0
    ? topupPackages
    : TOPUP_PACKAGES.map((pkg) => ({ ...pkg, available: false }))

  const topupDescriptions: Record<string, string> = {
    topup_25: "a quick boost",
    topup_50: "extra runs between cycles",
    topup_100: "most credits per dollar",
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose()
      }
    }}>
      <DialogContent className="w-[94vw] min-w-[720px] border-white/[0.05] bg-[#0d0d10] p-0 text-white sm:rounded-2xl [&_button[data-slot=dialog-close]]:top-3 [&_button[data-slot=dialog-close]]:right-3 [&_button[data-slot=dialog-close]]:opacity-40 [&_button[data-slot=dialog-close]]:hover:opacity-80 [&_button[data-slot=dialog-close]]:transition-opacity">
        <div className="px-6 py-5 overflow-y-auto max-h-[88vh] scrollbar-thin scrollbar-thumb-white/[0.06]">
          <DialogHeader className="items-start text-left">
            <DialogTitle className="text-[28px] font-semibold tracking-tight text-[#EDEDF0] leading-tight">
              Choose a plan
            </DialogTitle>
            <p className="mt-2 text-[13px] leading-relaxed text-[#8A8A90]">
              Upgrade when you need more credits, private projects, or priority access.
            </p>
          </DialogHeader>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex gap-0.5 p-0.5 bg-[#141419] border border-white/[0.06] rounded-lg" role="radiogroup" aria-label="Billing cycle">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "whitespace-nowrap px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all",
                  billingCycle === "monthly"
                    ? "bg-[#1E1E24] text-[#EDEDF0]"
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
                  "whitespace-nowrap flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  billingCycle === "yearly"
                    ? "bg-[#1E1E24] text-[#EDEDF0]"
                    : "text-[#6B6B70] hover:text-[#9B9B9F]"
                )}
                role="radio"
                aria-checked={billingCycle === "yearly"}
              >
                Yearly
                {hasYearlyPlans && (
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Save 17%</span>
                )}
              </button>
            </div>

            <div className={cn("flex items-center gap-1 text-[10px] text-[#5B5B60] opacity-70", isPricingLoading && "animate-pulse")}>
              <Lock className="h-2.5 w-2.5" />
              <span>{isPricingLoading ? "Syncing..." : "Secured by Stripe"}</span>
            </div>
          </div>

          {pricingIssues.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-2.5 text-[12px] text-amber-200/90">
              Some Stripe plans are currently unavailable. Only plans with configured live Stripe prices can be purchased.
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {plans.map((plan, index) => {
              const price = plan.id === "free" ? "$0" : formatCurrency(plan.amount, plan.currency)
              const sublabel = plan.id === "free"
                ? "No credit card required"
                : !plan.isConfiguredForCycle
                  ? "Not configured yet"
                  : billingCycle === "monthly"
                    ? "Billed monthly"
                    : `Billed annually${plan.yearlySavings > 0 ? ` · Save ${formatCurrency(plan.yearlySavings, plan.currency)}` : ""}`

              const planCopy = plan.id === "free"
                ? "for small projects"
                : plan.id === "pro"
                  ? "for creators who need more room"
                  : "for teams and heavier use"

              return (
                <motion.div
                  key={plan.id}
                  custom={index}
                  initial="hidden"
                  animate="visible"
                  variants={cardVariants}
                  className={cn(
                    "relative flex flex-col rounded-xl p-4 transition-colors",
                    plan.badge
                      ? "bg-[#17171C] border border-white/[0.11]"
                      : "bg-[#141419] border border-white/[0.06] hover:border-white/[0.08]"
                  )}
                >
                  {plan.badge && (
                    <div className="absolute -top-1.5 left-4 rounded-full bg-[#C8C8CC] px-1.5 py-px text-[9px] font-medium text-[#0d0d10]">
                      {plan.badge}
                    </div>
                  )}

                  <h3 className={cn("text-[14px] font-semibold capitalize text-[#EDEDF0]", plan.badge && "mt-1")}>
                    {plan.name}
                  </h3>

                  <div className="mt-2 flex items-baseline gap-0.5">
                    <span className="text-[38px] font-semibold tracking-tight text-[#EDEDF0] leading-none">{price}</span>
                    {plan.id !== "free" && (
                      <span className="text-[11px] text-[#5B5B60] ml-0.5">
                        /{billingCycle === "monthly" ? "mo" : "yr"}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[13px] leading-relaxed text-[#8A8A90]">
                    {planCopy}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6B6B70]">{sublabel}</p>

                  <div className="mt-3 flex-1 space-y-1">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <Check className={cn(
                          "mt-0.5 h-3 w-3 flex-shrink-0",
                          plan.badge ? "text-[#B5B5BA]" : "text-[#5B5B60]"
                        )} />
                        <span className="text-[13px] leading-tight text-[#B0B0B5]">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {plan.isCurrentTier ? (
                    <div className="mt-3 text-center text-[11px] font-medium text-[#6B6B70]">
                      Current plan
                    </div>
                  ) : plan.id === "free" ? (
                    <div className="mt-3 text-center text-[11px] font-medium text-[#6B6B70]">
                      Included
                    </div>
                  ) : (
                    <button
                      className={cn(
                        "mt-3 flex items-center justify-center gap-1 w-full rounded-md py-1.5 text-[12px] font-medium transition-all",
                        plan.badge
                          ? "bg-[#D8D8DB] text-[#1a1a1f] hover:bg-[#E0E0E3] hover:-translate-y-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                          : "bg-[#1E1E24] text-[#C0C0C5] border border-white/[0.06] hover:border-white/[0.10] hover:-translate-y-0.5"
                      )}
                      disabled={isLoading !== null || !plan.isConfiguredForCycle}
                      onClick={() => {
                        if (plan.isConfiguredForCycle) {
                          void onCheckout(plan.id as PaidSubscriptionTier)
                        }
                      }}
                    >
                      {isLoading === plan.id ? "Processing..." : !plan.isConfiguredForCycle ? "Unavailable" : `Upgrade to ${plan.name}`}
                      {isLoading !== plan.id && plan.isConfiguredForCycle && (
                        <ArrowRight className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-medium text-[#C0C0C5]">Need extra credits?</h3>
              <span className="text-[10px] text-[#5B5B60]">Buy one-time credits for extra generations</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {visibleTopupPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={cn(
                    "group rounded-lg border bg-[#141419] px-3 py-2 transition-colors hover:border-white/[0.10]",
                    pkg.id === "topup_100" ? "border-white/[0.09]" : "border-white/[0.06]"
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] font-semibold text-[#EDEDF0]">{pkg.credits}</span>
                    <span className="text-[10px] text-[#5B5B60]">credits</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#8A8A90]">
                    {formatCurrency(pkg.price, "usd")} · {topupDescriptions[pkg.id] ?? "extra credits"}
                  </p>
                  <button
                    className="mt-2 flex items-center justify-center gap-1 w-full rounded-md py-1.5 text-[12px] font-medium bg-[#1E1E24] text-[#C0C0C5] border border-white/[0.06] hover:border-white/[0.10] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    disabled={isLoading !== null || !pkg.available}
                    onClick={() => {
                      if (pkg.available) {
                        void onTopupCheckout(pkg.id)
                      }
                    }}
                  >
                    {isLoading === pkg.id ? "Processing..." : pkg.available ? "Buy" : "Unavailable"}
                    {isLoading !== pkg.id && pkg.available && <ArrowRight className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
