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

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
}

// Topup packages matching lib/pricing.ts
const TOPUP_PACKAGES = [
  { id: "topup_25", credits: 25, price: 5 },
  { id: "topup_50", credits: 50, price: 10 },
  { id: "topup_100", credits: 100, price: 20 },
]

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [isLoading, setIsLoading] = React.useState<string | null>(null)
  const [showTopups, setShowTopups] = React.useState(false)
  const [paymentMethod, setPaymentMethod] = React.useState<'stripe' | 'khalti'>('stripe')

  const onCheckout = async (priceId: string, planId?: string) => {
    if (paymentMethod === 'khalti') {
      if (!planId) return
      await onKhaltiCheckout(planId)
      return
    }

    try {
      setIsLoading(priceId)
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsLoading(null)
    }
  }

  const onKhaltiCheckout = async (planId: string) => {
    try {
      setIsLoading(planId)
      const response = await fetch("/api/khalti/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId }),
      })

      if (!response.ok) {
        throw new Error("Failed to initiate Khalti payment")
      }

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error("Failed to initiate Khalti payment")
      }
    } catch (error) {
      console.error(error)
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsLoading(null)
    }
  }

  const onTopupCheckout = async (packageId: string) => {
    if (paymentMethod === 'khalti') {
      await onKhaltiCheckout(packageId)
      return
    }

    try {
      setIsLoading(packageId)
      const response = await fetch("/api/stripe/topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packageId }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsLoading(null)
    }
  }

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      priceId: "free",
      description: "Perfect for exploring and small projects",
      features: [
        "20 prompts per month",
        "All AI models",
        "Public projects",
        "Community support"
      ],
      buttonText: "Current Plan",
      buttonVariant: "outline" as const,
      current: true
    },
    {
      id: "pro",
      name: "Pro",
      price: paymentMethod === 'khalti' ? "NPR 1,300" : "$10",
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "price_pro",
      period: "/month",
      description: "For creators who need more power",
      features: [
        "120 prompts per month",
        "All AI models",
        "Private projects",
        "Export to code",
        "Version history",
        "Priority support"
      ],
      buttonText: paymentMethod === 'khalti' ? "Pay with Khalti" : "Upgrade to Pro",
      buttonVariant: "default" as const,
      popular: true,
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20"
    },
    {
      id: "proplus",
      name: "Pro Plus",
      price: paymentMethod === 'khalti' ? "NPR 4,000" : "$30",
      priceId: process.env.NEXT_PUBLIC_STRIPE_PROPLUS_PRICE_ID || "price_proplus",
      period: "/month",
      description: "For power users and teams",
      features: [
        "350 prompts per month",
        "All AI models",
        "Private projects",
        "Export to code",
        "Version history",
        "Priority support",
        "Early access to new features"
      ],
      buttonText: paymentMethod === 'khalti' ? "Pay with Khalti" : "Upgrade to Pro Plus",
      buttonVariant: "default" as const,
      icon: Crown,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20"
    }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] bg-zinc-950 border-white/10 text-zinc-100 p-0 overflow-hidden outline-none">
        <div className="p-8">
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

            <div className="flex p-1 bg-white/5 rounded-lg border border-white/10">
              <button
                onClick={() => setPaymentMethod('stripe')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                  paymentMethod === 'stripe' 
                    ? "bg-white text-black shadow-sm" 
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Card (Stripe)
              </button>
              <button
                onClick={() => setPaymentMethod('khalti')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                  paymentMethod === 'khalti' 
                    ? "bg-[#5C2D91] text-white shadow-sm" 
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Khalti (NPR)
              </button>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const Icon = plan.icon
              return (
                <div 
                  key={plan.name}
                  className={cn(
                    "relative flex flex-col p-6 rounded-2xl border transition-all duration-300",
                    plan.popular 
                      ? "bg-zinc-900 border-white/20 shadow-2xl scale-[1.02] z-10" 
                      : "bg-black border-white/5 hover:border-white/10"
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      {Icon && (
                        <div className={cn("p-1.5 rounded-lg", plan.bg)}>
                          <Icon className={cn("w-4 h-4", plan.color)} />
                        </div>
                      )}
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      {plan.period && <span className="text-zinc-500 text-sm">{plan.period}</span>}
                    </div>
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                      {plan.description}
                    </p>
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
                    variant={plan.popular ? "default" : "outline"}
                    className={cn(
                      "w-full rounded-xl py-5 text-xs font-bold transition-all",
                      plan.popular 
                        ? "bg-white text-black hover:bg-zinc-200 border-none" 
                        : "bg-transparent border-white/20 text-white hover:bg-white/5 hover:border-white/30"
                    )}
                    disabled={plan.current || isLoading !== null}
                    onClick={() => !plan.current && onCheckout(plan.priceId, plan.id)}
                  >
                    {isLoading === plan.priceId ? "Processing..." : plan.buttonText}
                    {!plan.current && isLoading !== plan.priceId && <ArrowRight className="w-3 h-3 ml-2" />}
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
                <div className="w-full grid grid-cols-3 gap-4 mt-2">
                  {TOPUP_PACKAGES.map((pkg) => {
                    const displayPrice = paymentMethod === 'khalti'
                      ? (pkg.id === 'topup_25' ? 'NPR 600' : pkg.id === 'topup_50' ? 'NPR 1,200' : 'NPR 2,500')
                      : `$${pkg.price}`
                      
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
                          onClick={() => onTopupCheckout(pkg.id)}
                        >
                          {isLoading === pkg.id ? "..." : displayPrice}
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
