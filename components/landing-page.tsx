"use client"

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react"
import Link from "next/link"
import { DM_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google"
import {
  ArrowRight,
  Check,
  Code2,
  Compass,
  Eye,
  Github,
  LayoutTemplate,
  Menu,
  Moon,
  Palette,
  Play,
  Sparkles,
  WandSparkles,
  X,
  Sun,
} from "lucide-react"
import { useSession } from "next-auth/react"

import { useAuthDialog } from "@/components/auth-dialog-provider"
import { FOOTER_LINKS, SITE_LINKS } from "@/lib/site-config"
import { TIERS, type SubscriptionTier } from "@/lib/pricing"
import { useEditor } from "@/stores/editor-store"

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-codeui-body",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-codeui-display",
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-codeui-mono",
})

const LANDING_PLAN_ORDER: SubscriptionTier[] = ["free", "pro", "proplus"]

const brandStack = ["React", "Tailwind", "Next.js", "Monaco", "OpenRouter", "Stripe"]

const featureCards = [
  {
    icon: <WandSparkles className="h-5 w-5" />,
    title: "Prompt-to-UI generation",
    description:
      "Turn a single brief into a structured first draft with sections, layout, copy, and production-ready markup in one pass.",
  },
  {
    icon: <Eye className="h-5 w-5" />,
    title: "Live preview feedback loop",
    description:
      "See changes immediately while you iterate. The output stays inspectable, editable, and easy to refine instead of disappearing behind abstractions.",
  },
  {
    icon: <Palette className="h-5 w-5" />,
    title: "Design mode control",
    description:
      "Adjust spacing, typography, color, and component feel visually without giving up access to the underlying code.",
  },
  {
    icon: <Code2 className="h-5 w-5" />,
    title: "Clean React and Tailwind",
    description:
      "Generated output stays aligned with developer workflows, readable in review, and compatible with real project structure.",
  },
  {
    icon: <Compass className="h-5 w-5" />,
    title: "Discover and remix",
    description:
      "Browse public work, inspect ideas, and use gallery projects as a faster starting point for your own direction.",
  },
  {
    icon: <LayoutTemplate className="h-5 w-5" />,
    title: "Versioned iteration",
    description:
      "Checkpoint changes, compare directions, and return to stronger versions as prompts, code, and design evolve together.",
  },
] as const

const workflowSteps = [
  {
    step: "01",
    title: "Describe what you need",
    description:
      "Start with a landing page idea, UI block, dashboard concept, or refinement request in plain language.",
  },
  {
    step: "02",
    title: "Refine across modes",
    description:
      "Move between chat, preview, design controls, and code until the draft matches the direction you actually want.",
  },
  {
    step: "03",
    title: "Ship or export",
    description:
      "Keep building in the editor, share through Discover, or export the result into your product workflow.",
  },
] as const

const integrationCards = [
  { label: "React", glyph: "<>" },
  { label: "Tailwind", glyph: "tw" },
  { label: "Next.js", glyph: "N" },
  { label: "Monaco", glyph: "{}" },
  { label: "OpenRouter", glyph: "AI" },
  { label: "Stripe", glyph: "$" },
] as const

const outcomeCards = [
  {
    title: "From blank page to first draft",
    description:
      "Use CodeUI when the hardest part is getting momentum. The first version shows up fast enough to critique instead of imagine.",
  },
  {
    title: "From rough output to polished UI",
    description:
      "Tighten structure, rewrite copy, tune spacing, and inspect the generated code without bouncing between disconnected tools.",
  },
  {
    title: "From experiment to reusable asset",
    description:
      "Promising explorations can turn into saved versions, shareable discoveries, and exportable components rather than disposable prototypes.",
  },
] as const

function ThemeToggle() {
  const { state, setTheme } = useEditor()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="h-10 w-10" />

  const isDark = state.theme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white/80 text-[#08080a] transition-all duration-500 hover:border-black/30 dark:border-white/10 dark:bg-[#101016] dark:text-[#faff69] dark:hover:border-[#c8ff3c]/50"
      aria-label="Toggle theme"
    >
      <span
        className={`absolute transition-all duration-500 ${isDark ? "translate-y-8 rotate-45 opacity-0" : "translate-y-0 rotate-0 opacity-100"}`}
      >
        <Sun className="h-4 w-4" />
      </span>
      <span
        className={`absolute transition-all duration-500 ${isDark ? "translate-y-0 rotate-0 opacity-100" : "-translate-y-8 -rotate-45 opacity-0"}`}
      >
        <Moon className="h-4 w-4" />
      </span>
    </button>
  )
}

function PrimaryAction({
  isSignedIn,
  onSignIn,
  className,
  children,
}: {
  isSignedIn: boolean
  onSignIn: () => void
  className: string
  children: ReactNode
}) {
  if (isSignedIn) {
    return (
      <Link href="/dashboard" className={className}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onSignIn} className={className}>
      {children}
    </button>
  )
}

function AnchorLink({
  href,
  className,
  onNavigate,
  children,
}: {
  href: string
  className: string
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void
  children: ReactNode
}) {
  return (
    <a href={href} className={className} onClick={(event) => onNavigate(event, href)}>
      {children}
    </a>
  )
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="reveal text-[11px] uppercase tracking-[0.2em] text-[#7a7a8e] dark:text-[#c8ff3c]/70">
      <span style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>{children}</span>
    </div>
  )
}

function FeatureCard({ icon, title, description, delay = "" }: { icon: ReactNode; title: string; description: string; delay?: string }) {
  return (
    <div className={`reveal ${delay} card-glow rounded-[28px] border border-black/6 bg-white/60 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.04)] transition-colors duration-500 hover:bg-white dark:border-white/[0.04] dark:bg-white/[0.03] dark:shadow-none dark:hover:bg-white/[0.05] lg:p-8`}>
      <div className="feature-icon mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-black/5 text-[#111118] dark:border-white/[0.04] dark:text-[#c8ff3c]">
        {icon}
      </div>
      <h3 className="mb-2.5 text-[15px] font-semibold text-[#101016] dark:text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-[#5a5a70] dark:text-[#7a7a8e]">{description}</p>
    </div>
  )
}

export function LandingPage() {
  const { showSignIn } = useAuthDialog()
  const { data: session } = useSession()
  const isSignedIn = Boolean(session)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [billingAnnual, setBillingAnnual] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const timeoutsRef = useRef<number[]>([])
  const metricsAnimatedRef = useRef(false)
  const terminalAnimatedRef = useRef(false)

  useEffect(() => {
    const onScroll = () => {
      setNavScrolled(window.scrollY > 60)
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const revealElements = Array.from(root.querySelectorAll<HTMLElement>(".reveal"))
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible")
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    )

    for (const element of revealElements) {
      revealObserver.observe(element)
    }

    const metricsSentinel = root.querySelector<HTMLElement>("[data-metric-sentinel]")
    const terminalSentinel = root.querySelector<HTMLElement>("#terminalContent")

    const animateMetrics = () => {
      if (metricsAnimatedRef.current) return
      metricsAnimatedRef.current = true

      const metrics = Array.from(root.querySelectorAll<HTMLElement>(".metric-value[data-target]"))

      for (const metric of metrics) {
        const target = Number.parseFloat(metric.dataset.target ?? "0")
        const suffix = metric.dataset.suffix ?? ""
        const decimals = Number.parseInt(metric.dataset.decimals ?? "0", 10)
        const duration = 1800
        let startTime: number | null = null

        const update = (timestamp: number) => {
          if (startTime === null) startTime = timestamp

          const progress = Math.min((timestamp - startTime) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 4)
          const value = eased * target

          metric.textContent = decimals > 0 ? `${value.toFixed(decimals)}${suffix}` : `${Math.floor(value).toLocaleString()}${suffix}`

          if (progress < 1) {
            window.requestAnimationFrame(update)
          }
        }

        window.requestAnimationFrame(update)
      }
    }

    const metricsObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            animateMetrics()
            metricsObserver.disconnect()
            break
          }
        }
      },
      { threshold: 0.4 }
    )

    if (metricsSentinel) {
      metricsObserver.observe(metricsSentinel)
    }

    const animateTerminal = () => {
      if (terminalAnimatedRef.current) return
      terminalAnimatedRef.current = true

      const lines = Array.from(root.querySelectorAll<HTMLElement>(".terminal-line"))
      for (const line of lines) {
        const delay = Number.parseInt(line.dataset.delay ?? "0", 10)
        const timeout = window.setTimeout(() => {
          line.classList.add("terminal-visible")
        }, delay)
        timeoutsRef.current.push(timeout)
      }
    }

    const terminalObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            animateTerminal()
            terminalObserver.disconnect()
            break
          }
        }
      },
      { threshold: 0.3 }
    )

    if (terminalSentinel) {
      terminalObserver.observe(terminalSentinel)
    }

    return () => {
      revealObserver.disconnect()
      metricsObserver.disconnect()
      terminalObserver.disconnect()
      for (const timeout of timeoutsRef.current) {
        window.clearTimeout(timeout)
      }
      timeoutsRef.current = []
    }
  }, [])

  const handleAnchorNavigation = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) {
      setMobileMenuOpen(false)
      return
    }

    const target = document.querySelector<HTMLElement>(href)
    if (!target) return

    event.preventDefault()
    setMobileMenuOpen(false)
    const offset = 88
    const top = target.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: "smooth" })
  }

  const pricingPlans = LANDING_PLAN_ORDER.map((planId) => {
    const plan = TIERS[planId]
    const annualEquivalent = plan.priceYearly ? Math.round(plan.priceYearly / 12) : plan.priceMonthly

    return {
      id: planId,
      name: plan.name,
      description: plan.description,
      monthlyCredits: plan.monthlyCredits,
      features: plan.features,
      isHighlighted: planId === "pro",
      displayPrice: billingAnnual ? annualEquivalent : plan.priceMonthly,
      billingLabel:
        plan.priceMonthly === 0
          ? "/month"
          : billingAnnual && plan.priceYearly
            ? "/month billed yearly"
            : "/month",
    }
  })

  const rootClasses = [
    dmSans.variable,
    instrumentSerif.variable,
    jetBrainsMono.variable,
    "codeui-landing grain min-h-screen bg-[#f5f5f1] text-[#101016] transition-colors duration-500 dark:bg-[#08080a] dark:text-[#d4d4e0]",
  ].join(" ")

  return (
    <div ref={rootRef} className={rootClasses}>
      <style jsx global>{`
        .codeui-landing {
          font-family: var(--font-codeui-body), system-ui, sans-serif;
          overflow-x: hidden;
        }
        .codeui-landing .reveal {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .codeui-landing .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .codeui-landing .reveal-delay-1 { transition-delay: 0.1s; }
        .codeui-landing .reveal-delay-2 { transition-delay: 0.2s; }
        .codeui-landing .reveal-delay-3 { transition-delay: 0.3s; }
        .codeui-landing .reveal-delay-4 { transition-delay: 0.4s; }
        .codeui-landing .reveal-delay-5 { transition-delay: 0.5s; }
        .codeui-landing .hero-orb {
          position: absolute;
          inset: 0 auto auto 50%;
          width: 820px;
          height: 820px;
          border-radius: 9999px;
          transform: translateX(-50%);
          background: radial-gradient(circle, rgba(184, 212, 87, 0.12) 0%, rgba(184, 212, 87, 0.06) 36%, rgba(184, 212, 87, 0.02) 56%, transparent 72%);
          pointer-events: none;
          animation: orbPulse 8s ease-in-out infinite;
        }
        .dark .codeui-landing .hero-orb {
          background: radial-gradient(circle, rgba(200, 255, 60, 0.08) 0%, rgba(200, 255, 60, 0.04) 38%, rgba(200, 255, 60, 0.02) 55%, transparent 72%);
        }
        @keyframes orbPulse {
          0%, 100% { opacity: 0.78; transform: translateX(-50%) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.05); }
        }
        .codeui-landing .grain::after {
          content: "";
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          opacity: 0.22;
          z-index: 9999;
        }
        .codeui-landing .card-glow {
          position: relative;
          overflow: hidden;
        }
        .codeui-landing .card-glow::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(184, 212, 87, 0.26), rgba(184, 212, 87, 0.02) 50%, transparent);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.45s ease;
        }
        .dark .codeui-landing .card-glow::before {
          background: linear-gradient(135deg, rgba(200, 255, 60, 0.18), rgba(200, 255, 60, 0.04) 50%, transparent);
        }
        .codeui-landing .card-glow:hover::before {
          opacity: 1;
        }
        .codeui-landing .feature-icon {
          background: linear-gradient(135deg, rgba(184, 212, 87, 0.18), rgba(184, 212, 87, 0.06));
        }
        .dark .codeui-landing .feature-icon {
          background: linear-gradient(135deg, rgba(200, 255, 60, 0.1), rgba(200, 255, 60, 0.03));
        }
        .codeui-landing .terminal-line {
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .codeui-landing .terminal-line.terminal-visible {
          opacity: 1;
        }
        .codeui-landing .metric-value {
          font-variant-numeric: tabular-nums;
        }
        .codeui-landing .nav-blur {
          backdrop-filter: blur(20px) saturate(1.2);
          -webkit-backdrop-filter: blur(20px) saturate(1.2);
        }
        .codeui-landing .hr-gradient {
          height: 1px;
          border: none;
          background: linear-gradient(90deg, transparent, rgba(184, 212, 87, 0.35), transparent);
        }
        .dark .codeui-landing .hr-gradient {
          background: linear-gradient(90deg, transparent, rgba(200, 255, 60, 0.2), transparent);
        }
        @media (max-width: 768px) {
          .codeui-landing .hero-orb {
            width: 520px;
            height: 520px;
          }
        }
      `}</style>

      <nav
        className={`nav-blur fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${navScrolled ? "border-black/10 bg-[#f5f5f1]/90 shadow-[0_10px_30px_rgba(0,0,0,0.05)] dark:border-white/[0.06] dark:bg-[#08080a]/92 dark:shadow-none" : "border-black/5 bg-[#f5f5f1]/70 dark:border-white/[0.04] dark:bg-[#08080a]/80"}`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:h-[72px] lg:px-8">
          <a href="#top" className="flex items-center gap-2.5" onClick={(event) => handleAnchorNavigation(event, "#top")}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b8d457] text-[#08080a] dark:bg-[#c8ff3c]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L12.5 4.5V9.5L7 13L1.5 9.5V4.5L7 1Z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-[#101016] dark:text-white">CodeUI</span>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <AnchorLink href="#features" onNavigate={handleAnchorNavigation} className="text-[13px] text-[#66667a] transition-colors hover:text-[#101016] dark:text-[#7a7a8e] dark:hover:text-white">
              Features
            </AnchorLink>
            <AnchorLink href="#workflow" onNavigate={handleAnchorNavigation} className="text-[13px] text-[#66667a] transition-colors hover:text-[#101016] dark:text-[#7a7a8e] dark:hover:text-white">
              Workflow
            </AnchorLink>
            <AnchorLink href="#pricing" onNavigate={handleAnchorNavigation} className="text-[13px] text-[#66667a] transition-colors hover:text-[#101016] dark:text-[#7a7a8e] dark:hover:text-white">
              Pricing
            </AnchorLink>
            <Link href={SITE_LINKS.discover} className="text-[13px] text-[#66667a] transition-colors hover:text-[#101016] dark:text-[#7a7a8e] dark:hover:text-white">
              Discover
            </Link>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <ThemeToggle />
            {!isSignedIn ? (
              <>
                <button type="button" onClick={showSignIn} className="text-[13px] text-[#66667a] transition-colors hover:text-[#101016] dark:text-[#a0a0b4] dark:hover:text-white">
                  Sign in
                </button>
                <PrimaryAction
                  isSignedIn={isSignedIn}
                  onSignIn={showSignIn}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#b8d457] px-4 py-2 text-[13px] font-semibold text-[#08080a] transition-colors hover:bg-[#a7c44d] dark:bg-[#c8ff3c] dark:hover:bg-[#a3d630]"
                >
                  Start building free
                </PrimaryAction>
              </>
            ) : (
              <PrimaryAction
                isSignedIn={isSignedIn}
                onSignIn={showSignIn}
                className="inline-flex items-center gap-2 rounded-xl bg-[#b8d457] px-4 py-2 text-[13px] font-semibold text-[#08080a] transition-colors hover:bg-[#a7c44d] dark:bg-[#c8ff3c] dark:hover:bg-[#a3d630]"
              >
                Dashboard
              </PrimaryAction>
            )}
          </div>

          <div className="flex items-center gap-3 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="text-[#66667a] transition-colors hover:text-[#101016] dark:text-[#a0a0b4] dark:hover:text-white"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="nav-blur border-t border-black/6 bg-[#f5f5f1]/95 px-6 py-6 dark:border-white/[0.04] dark:bg-[#08080a]/95 md:hidden">
            <div className="space-y-4">
              <AnchorLink href="#features" onNavigate={handleAnchorNavigation} className="block text-sm text-[#66667a] hover:text-[#101016] dark:text-[#a0a0b4] dark:hover:text-white">
                Features
              </AnchorLink>
              <AnchorLink href="#workflow" onNavigate={handleAnchorNavigation} className="block text-sm text-[#66667a] hover:text-[#101016] dark:text-[#a0a0b4] dark:hover:text-white">
                Workflow
              </AnchorLink>
              <AnchorLink href="#pricing" onNavigate={handleAnchorNavigation} className="block text-sm text-[#66667a] hover:text-[#101016] dark:text-[#a0a0b4] dark:hover:text-white">
                Pricing
              </AnchorLink>
              <Link href={SITE_LINKS.discover} className="block text-sm text-[#66667a] hover:text-[#101016] dark:text-[#a0a0b4] dark:hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                Discover
              </Link>
            </div>
            <div className="mt-5 flex flex-col gap-3 border-t border-black/6 pt-5 dark:border-white/[0.06]">
              {!isSignedIn ? (
                <>
                  <button type="button" onClick={showSignIn} className="text-left text-sm text-[#66667a] hover:text-[#101016] dark:text-[#a0a0b4] dark:hover:text-white">
                    Sign in
                  </button>
                  <PrimaryAction
                    isSignedIn={isSignedIn}
                    onSignIn={showSignIn}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b8d457] px-4 py-3 text-sm font-semibold text-[#08080a] transition-colors hover:bg-[#a7c44d] dark:bg-[#c8ff3c] dark:hover:bg-[#a3d630]"
                  >
                    Start building free
                  </PrimaryAction>
                </>
              ) : (
                <PrimaryAction
                  isSignedIn={isSignedIn}
                  onSignIn={showSignIn}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b8d457] px-4 py-3 text-sm font-semibold text-[#08080a] transition-colors hover:bg-[#a7c44d] dark:bg-[#c8ff3c] dark:hover:bg-[#a3d630]"
                >
                  Open dashboard
                </PrimaryAction>
              )}
            </div>
          </div>
        ) : null}
      </nav>

      <main id="top">
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
          <div className="hero-orb" />

          <div className="relative z-10 mx-auto max-w-7xl px-6 py-24 text-center lg:px-8 lg:py-32">
            <div className="reveal inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/70 px-3.5 py-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.03)] dark:border-white/[0.06] dark:bg-white/[0.03] dark:shadow-none">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b8d457] dark:bg-[#c8ff3c]" />
              <span className="text-[11px] uppercase tracking-wide text-[#66667a] dark:text-[#a0a0b4]" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                Live preview, design controls, and export in one workflow
              </span>
            </div>

            <h1 className="reveal reveal-delay-1 mt-8">
              <span
                className="block text-5xl leading-[0.95] tracking-tight text-[#101016] sm:text-6xl md:text-7xl lg:text-8xl xl:text-[6.5rem] dark:text-white"
                style={{ fontFamily: "var(--font-codeui-display), Georgia, serif" }}
              >
                Interfaces that move
              </span>
              <span
                className="mt-1 block text-5xl italic leading-[1.05] tracking-tight text-[#8aa236] sm:text-6xl md:text-7xl lg:text-8xl xl:text-[6.5rem] dark:text-[#c8ff3c]"
                style={{ fontFamily: "var(--font-codeui-display), Georgia, serif" }}
              >
                at prompt speed
              </span>
            </h1>

            <p className="reveal reveal-delay-2 mx-auto mt-8 max-w-2xl text-base leading-relaxed text-[#5a5a70] dark:text-[#7a7a8e] sm:text-lg">
              CodeUI turns product ideas into editable UI fast, then keeps you in control with preview, design adjustments, clean React output, and versioned iteration.
            </p>

            <div className="reveal reveal-delay-3 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <PrimaryAction
                isSignedIn={isSignedIn}
                onSignIn={showSignIn}
                className="group inline-flex items-center gap-2 rounded-2xl bg-[#b8d457] px-7 py-3.5 text-sm font-semibold text-[#08080a] transition-colors hover:bg-[#a7c44d] dark:bg-[#c8ff3c] dark:hover:bg-[#a3d630]"
              >
                {isSignedIn ? "Open dashboard" : "Start building free"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </PrimaryAction>

              <Link
                href={SITE_LINKS.documentation}
                className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-7 py-3.5 text-sm font-medium text-[#101016] transition-colors hover:bg-white hover:border-black/20 dark:border-white/[0.08] dark:text-[#d4d4e0] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.03]"
              >
                <Play className="h-4 w-4" />
                Read docs
              </Link>
            </div>

            <div data-metric-sentinel className="reveal reveal-delay-4 mx-auto mt-20 grid max-w-2xl grid-cols-3 gap-8 border-t border-black/6 pt-10 dark:border-white/[0.04]">
              <div className="text-center">
                <div className="metric-value text-2xl font-medium text-[#101016] sm:text-3xl dark:text-white" style={{ fontFamily: "var(--font-codeui-mono), monospace" }} data-target="20" data-suffix="+" data-decimals="0">
                  0+
                </div>
                <div className="mt-1.5 text-[11px] uppercase tracking-wider text-[#77778a] dark:text-[#7a7a8e]">Monthly free prompts</div>
              </div>
              <div className="text-center">
                <div className="metric-value text-2xl font-medium text-[#101016] sm:text-3xl dark:text-white" style={{ fontFamily: "var(--font-codeui-mono), monospace" }} data-target="3" data-suffix=" modes" data-decimals="0">
                  0 modes
                </div>
                <div className="mt-1.5 text-[11px] uppercase tracking-wider text-[#77778a] dark:text-[#7a7a8e]">Preview, design, code</div>
              </div>
              <div className="text-center">
                <div className="metric-value text-2xl font-medium text-[#101016] sm:text-3xl dark:text-white" style={{ fontFamily: "var(--font-codeui-mono), monospace" }} data-target="100" data-suffix="%" data-decimals="0">
                  0%
                </div>
                <div className="mt-1.5 text-[11px] uppercase tracking-wider text-[#77778a] dark:text-[#7a7a8e]">Inspectable output</div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-40">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#77778a] dark:text-[#7a7a8e]" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                Scroll
              </span>
              <div className="h-8 w-px bg-gradient-to-b from-[#8aa236]/70 to-transparent dark:from-[#c8ff3c]/50" />
            </div>
          </div>
        </section>

        <section className="relative border-y border-black/5 py-16 dark:border-white/[0.03]">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="reveal mb-10 text-center text-[11px] uppercase tracking-[0.2em] text-[#88889b] dark:text-[#7a7a8e]/70" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
              Built around tools developers already use
            </p>
            <div className="reveal reveal-delay-1 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {brandStack.map((item) => (
                <div key={item} className="text-lg font-semibold tracking-tight text-[#101016]/70 transition-opacity hover:opacity-100 dark:text-white/70">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="relative py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-16 max-w-2xl lg:mb-20">
              <SectionEyebrow>Capabilities</SectionEyebrow>
              <h2 className="reveal reveal-delay-1 mt-4 text-4xl leading-[1.05] text-[#101016] sm:text-5xl lg:text-6xl dark:text-white" style={{ fontFamily: "var(--font-codeui-display), Georgia, serif" }}>
                Everything you need to go from prompt to polish,
                <br />
                <span className="italic text-[#6f7283] dark:text-[#a0a0b4]">without losing control of the code</span>
              </h2>
              <p className="reveal reveal-delay-2 mt-5 max-w-lg text-base leading-relaxed text-[#5a5a70] dark:text-[#7a7a8e]">
                CodeUI keeps ideation, iteration, visual editing, and developer-grade output in one place so UI work can move faster without becoming opaque.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {featureCards.map((card, index) => (
                <FeatureCard
                  key={card.title}
                  icon={card.icon}
                  title={card.title}
                  description={card.description}
                  delay={index % 3 === 1 ? "reveal-delay-1" : index % 3 === 2 ? "reveal-delay-2" : ""}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-black/5 py-24 dark:border-white/[0.03] lg:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div>
              <SectionEyebrow>Developer Experience</SectionEyebrow>
              <h2 className="reveal reveal-delay-1 mt-4 text-3xl leading-[1.1] text-[#101016] sm:text-4xl lg:text-5xl dark:text-white" style={{ fontFamily: "var(--font-codeui-display), Georgia, serif" }}>
                Move from vague direction to usable interface,
                <br />
                <span className="italic text-[#6f7283] dark:text-[#a0a0b4]">without waiting on a long setup loop</span>
              </h2>
              <p className="reveal reveal-delay-2 mt-5 max-w-md text-base leading-relaxed text-[#5a5a70] dark:text-[#7a7a8e]">
                Generate the first pass, inspect the structure, tune the styling, and keep iterating until the draft is strong enough to reuse.
              </p>

              <div className="reveal reveal-delay-3 mt-8 space-y-4">
                {[
                  "Prompt once, then refine with targeted follow-up changes",
                  "Switch between preview, design controls, and code instantly",
                  "Keep exported output aligned with real React and Tailwind workflows",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b8d457]/15 text-[#8aa236] dark:bg-[#c8ff3c]/10 dark:text-[#c8ff3c]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-[#3a3a4e] dark:text-[#d4d4e0]">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="reveal reveal-delay-2">
              <div className="overflow-hidden rounded-[28px] border border-black/6 bg-[#ffffff]/80 shadow-[0_35px_90px_rgba(0,0,0,0.08)] dark:border-white/[0.06] dark:bg-[#0c0c10] dark:shadow-[0_35px_90px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-2 border-b border-black/6 px-5 py-3.5 dark:border-white/[0.04]">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-black/8 dark:bg-white/[0.08]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-black/8 dark:bg-white/[0.08]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-black/8 dark:bg-white/[0.08]" />
                  </div>
                  <span className="ml-3 text-[11px] text-[#8a8aa0] dark:text-[#7a7a8e]/70" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                    generated-hero.tsx
                  </span>
                </div>
                <div className="p-5 text-[12.5px] leading-[1.85] text-[#2d3140] dark:text-[#a0a0b4] lg:p-6" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                  <div><span className="text-[#5c71ff]">export default</span> <span className="text-[#111118] dark:text-[#d4d4e0]">function</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">LandingHero</span>() {'{'}</div>
                  <div className="ml-4"><span className="text-[#111118] dark:text-[#d4d4e0]">return</span> (</div>
                  <div className="ml-8"><span className="text-[#111118] dark:text-[#d4d4e0]">&lt;section</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">className</span>=<span className="text-[#8f5ad7]">"grid gap-10 lg:grid-cols-[1.2fr_0.8fr]"</span><span className="text-[#111118] dark:text-[#d4d4e0]">&gt;</span></div>
                  <div className="ml-12"><span className="text-[#111118] dark:text-[#d4d4e0]">&lt;Headline</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">title</span>=<span className="text-[#8f5ad7]">"Build a sharper product page for CodeUI"</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">/&gt;</span></div>
                  <div className="ml-12"><span className="text-[#111118] dark:text-[#d4d4e0]">&lt;PreviewPanel</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">mode</span>=<span className="text-[#8f5ad7]">"design"</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">state</span>=<span className="text-[#8f5ad7]">"live"</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">/&gt;</span></div>
                  <div className="ml-8"><span className="text-[#111118] dark:text-[#d4d4e0]">&lt;/section&gt;</span></div>
                  <div className="ml-4">)</div>
                  <div>{'}'}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="relative border-t border-black/5 py-24 dark:border-white/[0.03] lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center lg:mb-20">
              <SectionEyebrow>How it works</SectionEyebrow>
              <h2 className="reveal reveal-delay-1 mt-4 text-4xl leading-[1.05] text-[#101016] sm:text-5xl lg:text-6xl dark:text-white" style={{ fontFamily: "var(--font-codeui-display), Georgia, serif" }}>
                Three steps from idea to <span className="italic">working UI</span>
              </h2>
              <p className="reveal reveal-delay-2 mt-5 text-base leading-relaxed text-[#5a5a70] dark:text-[#7a7a8e]">
                The loop stays simple enough to keep momentum and strong enough to survive real implementation.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3 lg:gap-0">
              {workflowSteps.map((step, index) => (
                <div key={step.step} className={`reveal text-center lg:px-10 ${index === 1 ? "reveal-delay-2" : index === 2 ? "reveal-delay-4" : ""}`}>
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-black/6 bg-white/70 dark:border-white/[0.06] dark:bg-white/[0.03]">
                    <span className="text-sm font-medium text-[#8aa236] dark:text-[#c8ff3c]" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                      {step.step}
                    </span>
                  </div>
                  <h3 className="mb-3 text-[15px] font-semibold text-[#101016] dark:text-white">{step.title}</h3>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-[#5a5a70] dark:text-[#7a7a8e]">{step.description}</p>
                </div>
              ))}
            </div>

            <div className="reveal mx-auto mt-16 max-w-2xl lg:mt-20">
              <div className="overflow-hidden rounded-[28px] border border-black/6 bg-white/70 dark:border-white/[0.06] dark:bg-[#0c0c10]">
                <div className="flex items-center gap-2 border-b border-black/6 px-5 py-3 dark:border-white/[0.04]">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-black/8 dark:bg-white/[0.08]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-black/8 dark:bg-white/[0.08]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-black/8 dark:bg-white/[0.08]" />
                  </div>
                  <span className="ml-3 text-[11px] text-[#8a8aa0] dark:text-[#7a7a8e]/70" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                    Session log
                  </span>
                </div>
                <div id="terminalContent" className="min-h-[180px] space-y-1 p-5 text-[12.5px] leading-[1.9]" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                  <div className="terminal-line terminal-visible"><span className="text-[#77778a] dark:text-[#7a7a8e]">$</span> <span className="text-[#2d3140] dark:text-[#d4d4e0]">Create a sharper CodeUI homepage with editor-focused messaging</span></div>
                  <div className="terminal-line" data-delay="600"><span className="text-[#77778a] dark:text-[#7a7a8e]">▸ Drafting hero structure and CTA hierarchy...</span></div>
                  <div className="terminal-line" data-delay="1200"><span className="text-[#77778a] dark:text-[#7a7a8e]">▸ Rendering preview mode panel</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">✓</span></div>
                  <div className="terminal-line" data-delay="1800"><span className="text-[#77778a] dark:text-[#7a7a8e]">▸ Applying design controls and spacing system</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">✓</span></div>
                  <div className="terminal-line" data-delay="2400"><span className="text-[#77778a] dark:text-[#7a7a8e]">▸ Syncing clean React output</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">✓</span></div>
                  <div className="terminal-line" data-delay="3000"><span className="font-medium text-[#8aa236] dark:text-[#c8ff3c]">✓ Updated homepage draft is ready for review</span></div>
                  <div className="terminal-line" data-delay="3600"><span className="text-[#77778a] dark:text-[#7a7a8e]">→</span> <span className="text-[#8aa236] dark:text-[#c8ff3c]">Open Preview / Design / Code</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-black/5 py-24 dark:border-white/[0.03] lg:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
            <div className="reveal order-2 lg:order-1">
              <div className="grid grid-cols-3 gap-3">
                {integrationCards.map((card) => (
                  <div key={card.label} className="card-glow flex flex-col items-center gap-3 rounded-2xl border border-black/6 bg-white/60 p-5 transition-colors duration-500 hover:bg-white dark:border-white/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.03] text-xs font-semibold text-[#3a3a4e] dark:bg-white/[0.04] dark:text-[#d4d4e0]" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                      {card.glyph}
                    </div>
                    <span className="text-[11px] font-medium text-[#66667a] dark:text-[#7a7a8e]">{card.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <SectionEyebrow>Integrations</SectionEyebrow>
              <h2 className="reveal reveal-delay-1 mt-4 text-3xl leading-[1.1] text-[#101016] sm:text-4xl lg:text-5xl dark:text-white" style={{ fontFamily: "var(--font-codeui-display), Georgia, serif" }}>
                Fits into a <span className="italic">real frontend workflow</span>
              </h2>
              <p className="reveal reveal-delay-2 mt-5 max-w-md text-base leading-relaxed text-[#5a5a70] dark:text-[#7a7a8e]">
                CodeUI is designed for teams who still care what ships: component structure, styling systems, model choice, auth, billing, and export paths all stay grounded in the actual product.
              </p>
              <Link href={SITE_LINKS.discover} className="reveal reveal-delay-3 mt-8 inline-flex items-center gap-2 text-sm font-medium text-[#8aa236] transition-colors hover:text-[#748a2d] dark:text-[#c8ff3c] dark:hover:text-[#a3d630]">
                Browse what people are building
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section id="testimonials" className="relative border-t border-black/5 py-24 dark:border-white/[0.03] lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <SectionEyebrow>Use cases</SectionEyebrow>
              <h2 className="reveal reveal-delay-1 mt-4 text-4xl leading-[1.05] text-[#101016] sm:text-5xl dark:text-white" style={{ fontFamily: "var(--font-codeui-display), Georgia, serif" }}>
                Built for teams that need <span className="italic">faster UI cycles</span>
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:gap-5">
              {outcomeCards.map((card, index) => (
                <div key={card.title} className={`reveal card-glow rounded-[28px] border border-black/6 bg-white/60 p-7 transition-colors duration-500 hover:bg-white dark:border-white/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.05] ${index === 1 ? "reveal-delay-1" : index === 2 ? "reveal-delay-2" : ""}`}>
                  <div className="mb-5 flex items-center gap-1 text-[#8aa236] dark:text-[#c8ff3c]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <Sparkles className="h-3.5 w-3.5" />
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-[#2d3140] dark:text-[#d4d4e0]">{card.description}</p>
                  <div>
                    <div className="text-[13px] font-medium text-[#101016] dark:text-white">{card.title}</div>
                    <div className="mt-1 text-[11px] text-[#77778a] dark:text-[#7a7a8e]">CodeUI workflow outcome</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="relative border-t border-black/5 py-24 dark:border-white/[0.03] lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <SectionEyebrow>Pricing</SectionEyebrow>
              <h2 className="reveal reveal-delay-1 mt-4 text-4xl leading-[1.05] text-[#101016] sm:text-5xl dark:text-white" style={{ fontFamily: "var(--font-codeui-display), Georgia, serif" }}>
                Simple pricing for <span className="italic">faster iteration</span>
              </h2>
              <p className="reveal reveal-delay-2 mt-5 text-base leading-relaxed text-[#5a5a70] dark:text-[#7a7a8e]">
                Start free, upgrade when prompt volume and private work demand more room.
              </p>
            </div>

            <div className="reveal mb-12 flex items-center justify-center gap-3">
              <span className={`text-sm ${billingAnnual ? "text-[#77778a] dark:text-[#7a7a8e]" : "font-medium text-[#101016] dark:text-white"}`}>Monthly</span>
              <button
                type="button"
                onClick={() => setBillingAnnual((value) => !value)}
                className="relative h-6 w-12 rounded-full bg-black/10 p-0.5 dark:bg-white/[0.08]"
                aria-label="Toggle billing cycle"
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-[#b8d457] transition-transform duration-300 dark:bg-[#c8ff3c] ${billingAnnual ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
              <span className={`text-sm ${billingAnnual ? "font-medium text-[#101016] dark:text-white" : "text-[#77778a] dark:text-[#7a7a8e]"}`}>
                Annual <span className="text-[11px] text-[#8aa236] dark:text-[#c8ff3c]" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>best value</span>
              </span>
            </div>

            <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3 lg:gap-5">
              {pricingPlans.map((plan, index) => (
                <div
                  key={plan.id}
                  className={`reveal card-glow relative rounded-[28px] p-7 transition-colors duration-500 lg:p-8 ${index === 1 ? "reveal-delay-1" : index === 2 ? "reveal-delay-2" : ""} ${plan.isHighlighted ? "border border-[#b8d457]/40 bg-[#f3f8de] hover:bg-[#eef5d1] dark:border-[#c8ff3c]/20 dark:bg-[#101016] dark:hover:bg-[#121218]" : "border border-black/6 bg-white/60 hover:bg-white dark:border-white/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"}`}
                >
                  {plan.isHighlighted ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#b8d457] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#08080a] dark:bg-[#c8ff3c]" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                      Most popular
                    </div>
                  ) : null}
                  <div className={`mb-4 text-[11px] uppercase tracking-[0.15em] ${plan.isHighlighted ? "text-[#7d952f] dark:text-[#c8ff3c]" : "text-[#77778a] dark:text-[#7a7a8e]"}`} style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                    {plan.name}
                  </div>
                  <div className="mb-2 flex items-baseline gap-1">
                    <span className="text-4xl text-[#101016] dark:text-white" style={{ fontFamily: "var(--font-codeui-display), Georgia, serif" }}>
                      ${plan.displayPrice}
                    </span>
                    <span className="text-sm text-[#77778a] dark:text-[#7a7a8e]">{plan.billingLabel}</span>
                  </div>
                  <p className="mb-2 text-[13px] text-[#5a5a70] dark:text-[#7a7a8e]">{plan.description}</p>
                  <p className="mb-7 text-[12px] uppercase tracking-[0.18em] text-[#8aa236] dark:text-[#c8ff3c]" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                    {plan.monthlyCredits} monthly credits
                  </p>
                  <PrimaryAction
                    isSignedIn={isSignedIn}
                    onSignIn={showSignIn}
                    className={`mb-7 flex w-full items-center justify-center rounded-xl py-3 text-sm font-semibold transition-colors ${plan.isHighlighted ? "bg-[#b8d457] text-[#08080a] hover:bg-[#a7c44d] dark:bg-[#c8ff3c] dark:hover:bg-[#a3d630]" : "border border-black/10 text-[#101016] hover:bg-white dark:border-white/[0.08] dark:text-[#d4d4e0] dark:hover:bg-white/[0.03]"}`}
                  >
                    {!isSignedIn ? (plan.id === "free" ? "Get started free" : "Sign in to upgrade") : "Manage in dashboard"}
                  </PrimaryAction>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5 text-[13px] text-[#3a3a4e] dark:text-[#d4d4e0]">
                        <Check className={`h-4 w-4 shrink-0 ${plan.isHighlighted ? "text-[#8aa236] dark:text-[#c8ff3c]" : "text-[#8aa236]/70 dark:text-[#c8ff3c]/70"}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-black/5 py-24 dark:border-white/[0.03] lg:py-32">
          <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
            <div className="mx-auto max-w-2xl">
              <h2 className="reveal text-4xl leading-[1.05] text-[#101016] sm:text-5xl lg:text-6xl dark:text-white" style={{ fontFamily: "var(--font-codeui-display), Georgia, serif" }}>
                Ready to build a sharper
                <br />
                <span className="italic text-[#8aa236] dark:text-[#c8ff3c]">first draft faster?</span>
              </h2>
              <p className="reveal reveal-delay-1 mx-auto mt-6 max-w-lg text-base leading-relaxed text-[#5a5a70] dark:text-[#7a7a8e]">
                Start with a prompt, refine with real controls, and keep every version close enough to the code to stay useful.
              </p>
              <div className="reveal reveal-delay-2 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <PrimaryAction
                  isSignedIn={isSignedIn}
                  onSignIn={showSignIn}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#b8d457] px-8 py-4 text-sm font-semibold text-[#08080a] transition-colors hover:bg-[#a7c44d] dark:bg-[#c8ff3c] dark:hover:bg-[#a3d630]"
                >
                  {isSignedIn ? "Go to dashboard" : "Start building free"}
                  <ArrowRight className="h-4 w-4" />
                </PrimaryAction>
                <Link href={SITE_LINKS.discover} className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-8 py-4 text-sm font-medium text-[#101016] transition-colors hover:bg-white dark:border-white/[0.08] dark:text-[#d4d4e0] dark:hover:bg-white/[0.03]">
                  Explore Discover
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/6 py-16 dark:border-white/[0.04] lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5 lg:gap-12">
            <div className="col-span-2 mb-4 md:col-span-4 lg:col-span-1 lg:mb-0">
              <a href="#top" className="mb-4 flex items-center gap-2.5" onClick={(event) => handleAnchorNavigation(event, "#top")}>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b8d457] text-[#08080a] dark:bg-[#c8ff3c]">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1L12.5 4.5V9.5L7 13L1.5 9.5V4.5L7 1Z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
                  </svg>
                </div>
                <span className="text-[15px] font-semibold tracking-tight text-[#101016] dark:text-white">CodeUI</span>
              </a>
              <p className="max-w-xs text-[13px] leading-relaxed text-[#5a5a70] dark:text-[#7a7a8e]">
                An AI UI builder for developers who want speed, visual feedback, and code they can still trust.
              </p>
              <div className="mt-5 flex items-center gap-4">
                <Link href={SITE_LINKS.github} target="_blank" rel="noreferrer" className="text-[#77778a] transition-colors hover:text-[#101016] dark:text-[#7a7a8e] dark:hover:text-white">
                  <Github className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-[11px] uppercase tracking-[0.15em] text-[#8a8aa0] dark:text-[#7a7a8e]/60" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                Product
              </h4>
              <ul className="space-y-2.5 text-[13px] text-[#5a5a70] dark:text-[#7a7a8e]">
                <li><a href="#features" onClick={(event) => handleAnchorNavigation(event, "#features")} className="transition-colors hover:text-[#101016] dark:hover:text-white">Features</a></li>
                <li><a href="#pricing" onClick={(event) => handleAnchorNavigation(event, "#pricing")} className="transition-colors hover:text-[#101016] dark:hover:text-white">Pricing</a></li>
                <li><Link href={SITE_LINKS.discover} className="transition-colors hover:text-[#101016] dark:hover:text-white">Discover</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-[11px] uppercase tracking-[0.15em] text-[#8a8aa0] dark:text-[#7a7a8e]/60" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                Resources
              </h4>
              <ul className="space-y-2.5 text-[13px] text-[#5a5a70] dark:text-[#7a7a8e]">
                <li><Link href={SITE_LINKS.documentation} className="transition-colors hover:text-[#101016] dark:hover:text-white">Documentation</Link></li>
                {FOOTER_LINKS.filter((link) => link.label !== "Documentation").slice(0, 2).map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} target={"external" in link && link.external ? "_blank" : undefined} rel={"external" in link && link.external ? "noreferrer" : undefined} className="transition-colors hover:text-[#101016] dark:hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-[11px] uppercase tracking-[0.15em] text-[#8a8aa0] dark:text-[#7a7a8e]/60" style={{ fontFamily: "var(--font-codeui-mono), monospace" }}>
                Company
              </h4>
              <ul className="space-y-2.5 text-[13px] text-[#5a5a70] dark:text-[#7a7a8e]">
                {FOOTER_LINKS.slice(2).map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} target={"external" in link && link.external ? "_blank" : undefined} rel={"external" in link && link.external ? "noreferrer" : undefined} className="transition-colors hover:text-[#101016] dark:hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="hr-gradient mb-8 mt-12" />

          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-[12px] text-[#8a8aa0] dark:text-[#7a7a8e]/70">© 2026 CodeUI. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              <span className="text-[12px] text-[#8a8aa0] dark:text-[#7a7a8e]/70">Editor, auth, billing, and discover flows live</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}