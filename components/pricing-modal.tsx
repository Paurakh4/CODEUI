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
  ShieldCheck, 
  Users, 
  Sparkles,
  ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [isLoading, setIsLoading] = React.useState<string | null>(null)

  const onCheckout = async (priceId: string) => {
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

  const plans = [
    {
      name: "Free",
      price: "$0",
      priceId: "free", // Placeholder
      description: "Perfect for exploring and small projects",
      features: [
        "500 monthly credits",
        "Standard generation speed",
        "Public projects",
        "Community support"
      ],
      buttonText: "Current Plan",
      buttonVariant: "outline" as const,
      current: true
    },
    {
      name: "Pro",
      price: "$20",
      priceId: "price_pro_monthly", // You should replace this with your actual Stripe price ID
      period: "/month",
      description: "For professionals who need more power",
      features: [
        "Unlimited credits",
        "Priority GOD MODE access",
        "Private projects",
        "Export to code",
        "Advanced style controls",
        "Priority support"
      ],
      buttonText: "Upgrade to Pro",
      buttonVariant: "default" as const,
      popular: true,
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20"
    },
    {
      name: "Enterprise",
      price: "Custom",
      priceId: "enterprise", // Placeholder
      description: "Custom solutions for large teams",
      features: [
        "Custom credit limits",
        "Dedicated infrastructure",
        "Team collaboration tools",
        "SSO & Advanced security",
        "Custom model fine-tuning",
        "24/7 Dedicated support"
      ],
      buttonText: "Contact Sales",
      buttonVariant: "outline" as const,
      icon: ShieldCheck,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20"
    }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] bg-zinc-950 border-white/10 text-zinc-100 p-0 overflow-hidden outline-none">
        <div className="p-8">
          <DialogHeader className="flex flex-col items-center text-center mb-10">
            <div className="flex justify-center mb-4">
              <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pricing Plans</span>
              </div>
            </div>
            <DialogTitle className="text-3xl font-bold tracking-tight mb-2 text-white text-center">Upgrade your creative power</DialogTitle>
            <p className="text-zinc-400 max-w-md mx-auto text-center">
              Choose the plan that's right for you and start building amazing UIs with CodeUI.
            </p>
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
                    onClick={() => !plan.current && onCheckout(plan.priceId)}
                  >
                    {isLoading === plan.priceId ? "Processing..." : plan.buttonText}
                    {!plan.current && isLoading !== plan.priceId && <ArrowRight className="w-3 h-3 ml-2" />}
                  </Button>
                </div>
              )
            })}
          </div>

          <div className="mt-10 pt-8 border-t border-white/5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
              <div>
                <h4 className="text-sm font-semibold mb-1 flex items-center gap-2 justify-center md:justify-start">
                  <Users className="w-4 h-4 text-zinc-400" />
                  Need a custom team plan?
                </h4>
                <p className="text-xs text-zinc-500">
                  Get in touch with our team for personalized onboarding and custom features.
                </p>
              </div>
              <Button variant="ghost" className="text-xs text-zinc-300 hover:text-white hover:bg-white/5 px-6">
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
