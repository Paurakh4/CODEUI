"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Terminal, Code2, Zap, Layout, MonitorSmartphone, Layers, Sun, Moon } from "lucide-react"
import Link from "next/link"
import { useAuthDialog } from "@/components/auth-dialog-provider"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useEditor } from "@/stores/editor-store"
import { FOOTER_LINKS, SITE_LINKS } from "@/lib/site-config"
import { TIERS, type SubscriptionTier } from "@/lib/pricing"

const LANDING_PLAN_ORDER: SubscriptionTier[] = ["free", "pro", "proplus"]

function ThemeToggle() {
  const { state, setTheme } = useEditor()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="w-10 h-10" />

  const isDark = state.theme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex items-center justify-center w-10 h-10 rounded-full border border-zinc-200 dark:border-[#414141]/80 bg-[#f9f9f9] dark:bg-[#141414] overflow-hidden transition-all duration-500 hover:border-[#000000] hover:dark:border-[#faff69] focus:outline-none"
      aria-label="Toggle Dark Mode"
    >
      <div 
        className={`absolute text-[#151515] transition-all duration-500 transform ${isDark ? "opacity-0 translate-y-8 rotate-45" : "opacity-100 translate-y-0 rotate-0"}`}
      >
        <Sun className="w-5 h-5" />
      </div>
      <div 
        className={`absolute text-[#faff69] transition-all duration-500 transform ${isDark ? "opacity-100 translate-y-0 rotate-0" : "opacity-0 -translate-y-8 -rotate-45"}`}
      >
        <Moon className="w-5 h-5" />
      </div>
    </button>
  )
}

export function LandingPage() {
  const { showSignIn } = useAuthDialog()
  const { data: session } = useSession()
  const pricingPlans = LANDING_PLAN_ORDER.map((planId) => ({
    id: planId,
    ...TIERS[planId],
    isHighlighted: planId === "pro",
  }))

  return (
    <div className="min-h-screen bg-[#ffffff] dark:bg-[#000000] text-[#000000] dark:text-[#ffffff] font-sans selection:bg-[#000000] selection:text-[#faff69] dark:selection:bg-[#faff69] dark:selection:text-black transition-colors duration-500">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 select-none">
            <svg viewBox="0 0 375 375" className="w-full h-full dark:hidden">
              <rect x="-37.5" y="-37.5" width="450" height="450" fill="#ffffff" />
              <path fill="#000000" d="M 300 150 L 225 150 L 225 225 L 300 225 L 300 300 L 225 300 L 225 225 L 150 225 L 150 300 L 75 300 L 75 225 L 150 225 L 150 150 L 75 150 L 75 75 L 150 75 L 150 150 L 225 150 L 225 75 L 300 75 Z M 300 0 L 0 0 L 0 375 L 375 375 L 375 0 L 300 0" />
            </svg>
            <svg viewBox="0 0 375 375" className="w-full h-full hidden dark:block">
              <rect x="-37.5" y="-37.5" width="450" height="450" fill="#000000" />
              <path fill="#faff69" d="M 300 150 L 225 150 L 225 225 L 300 225 L 300 300 L 225 300 L 225 225 L 150 225 L 150 300 L 75 300 L 75 225 L 150 225 L 150 150 L 75 150 L 75 75 L 150 75 L 150 150 L 225 150 L 225 75 L 300 75 Z M 300 0 L 0 0 L 0 375 L 375 375 L 375 0 L 300 0" />
            </svg>
          </div>
          <span className="text-xl font-black tracking-tight text-[#000000] dark:text-[#ffffff] hover:text-[#166534] dark:hover:text-[#faff69] transition-colors cursor-pointer">CodeUI</span>
        </div>
        <div className="hidden md:flex items-center gap-10 text-[16px] font-bold text-[#585858] dark:text-[#ffffff]">
          <a href="#features" className="hover:text-[#000000] dark:hover:text-[#faff69] transition-colors">Features</a>
          <a href="#performance" className="hover:text-[#000000] dark:hover:text-[#faff69] transition-colors">Performance</a>
          <a href="#pricing" className="hover:text-[#000000] dark:hover:text-[#faff69] transition-colors">Pricing</a>
          <Link href={SITE_LINKS.discover} className="hover:text-[#000000] dark:hover:text-[#faff69] transition-colors">Discover</Link>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {!session ? (
            <>
              <button 
                className="text-[#585858] dark:text-[#ffffff] hover:text-[#000000] dark:hover:text-[#faff69] transition-colors font-bold px-4 py-2"
                onClick={showSignIn}
              >
                Log In
              </button>
              <button 
                onClick={showSignIn}
                className="bg-[#000000] text-white dark:bg-[#166534] hover:bg-[#3a3a3a] dark:hover:bg-[#14572f] border border-transparent dark:border-[#141414] rounded px-5 py-2.5 font-bold transition-colors active:scale-[0.98]"
              >
                Get Started Free
              </button>
            </>
          ) : (
            <Link href="/dashboard">
              <button className="bg-[#000000] text-white dark:bg-[#166534] hover:bg-[#3a3a3a] dark:hover:bg-[#14572f] border border-transparent dark:border-[#141414] rounded px-5 py-2.5 font-bold transition-colors active:scale-[0.98]">
                Dashboard
              </button>
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-24 pb-32">
        <div className="flex flex-col space-y-8 max-w-5xl">
          <div className="uppercase tracking-[1.4px] text-[#585858] dark:text-[#a0a0a0] text-[14px] font-bold">
            The database-grade UI engine
          </div>
          
          <h1 className="text-[64px] md:text-[96px] font-black leading-[1.0] text-[#000000] dark:text-white max-w-4xl tracking-tight">
            BUILD INTERFACES AT <span className="text-[#166534] dark:text-[#faff69]">EXTREME SPEED.</span>
          </h1>
          
          <p className="text-[#585858] dark:text-[#a0a0a0] text-[20px] md:text-[24px] font-medium leading-[1.4] max-w-3xl">
            CodeUI generates production-ready React components instantly. Built for developers who demand absolute control, clean code, and zero abstractions.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4 pt-8">
            {!session ? (
              <button onClick={showSignIn} className="bg-[#faff69] text-[#151515] border border-[#161600] dark:border-[#faff69] rounded px-6 py-3.5 text-[18px] font-black hover:bg-[#e0e64c] dark:hover:bg-[#1d1d1d] hover:text-[#151515] dark:hover:text-[#faff69] active:scale-[0.98] transition-all flex items-center gap-2">
                Start Building <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <Link href="/dashboard">
                <button className="bg-[#faff69] text-[#151515] border border-[#161600] dark:border-[#faff69] rounded px-6 py-3.5 text-[18px] font-black hover:bg-[#e0e64c] dark:hover:bg-[#1d1d1d] hover:text-[#151515] dark:hover:text-[#faff69] active:scale-[0.98] transition-all flex items-center gap-2">
                  Start Building <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
            )}
            <Link href={SITE_LINKS.documentation} className="bg-transparent text-[#000000] dark:text-[#ffffff] border border-[#000000] dark:border-[#4f5100] rounded px-8 py-3.5 text-[18px] font-bold hover:bg-[#f4f4f4] dark:hover:bg-[#141414] active:scale-[0.98] transition-colors">
              Read the Docs
            </Link>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mt-32 border-t border-[#e5e7eb] dark:border-[#414141]/80 pt-16">
          <div className="flex flex-col">
            <span className="text-[72px] font-black text-[#000000] dark:text-white leading-none mb-2 hover:text-[#166534] dark:hover:text-[#faff69] transition-colors cursor-default">&lt; 2s</span>
            <span className="text-[#585858] dark:text-[#a0a0a0] text-[16px] font-bold">Average Generation Time</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[72px] font-black text-[#000000] dark:text-white leading-none mb-2 hover:text-[#166534] dark:hover:text-[#faff69] transition-colors cursor-default">0</span>
            <span className="text-[#585858] dark:text-[#a0a0a0] text-[16px] font-bold">Hidden Abstractions</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[72px] font-black text-[#000000] dark:text-white leading-none mb-2 hover:text-[#166534] dark:hover:text-[#faff69] transition-colors cursor-default">100%</span>
            <span className="text-[#585858] dark:text-[#a0a0a0] text-[16px] font-bold">Tailwind CSS Compatible</span>
          </div>
        </div>

        {/* IDE Preview / Code block mockup */}
        <section id="performance" className="mt-32">
          <div className="uppercase tracking-[1.4px] text-[#585858] dark:text-[#a0a0a0] text-[14px] font-bold mb-6">
            Developer Experience First
          </div>
          <div className="bg-[#f9f9f9] dark:bg-[#141414] border border-[#e5e7eb] dark:border-[#414141]/80 rounded-[8px] overflow-hidden shadow-[0px_4px_15px_rgba(0,0,0,0.05)_inset] dark:shadow-[0px_4px_25px_rgba(0,0,0,0.14)_inset] transition-colors">
            <div className="flex bg-[#ffffff] dark:bg-[#0a0a0a] border-b border-[#e5e7eb] dark:border-[#414141]/80 px-4 py-3 item-center gap-2">
              <div className="flex gap-2 items-center">
                <div className="w-3 h-3 rounded-full bg-[#d1d5db] dark:bg-[#414141]"></div>
                <div className="w-3 h-3 rounded-full bg-[#d1d5db] dark:bg-[#414141]"></div>
                <div className="w-3 h-3 rounded-full bg-[#d1d5db] dark:bg-[#414141]"></div>
              </div>
              <div className="ml-4 text-[#585858] dark:text-[#a0a0a0] text-[12px] font-mono flex items-center gap-2 font-bold">
                <Terminal className="w-3 h-3" /> main.tsx
              </div>
            </div>
            <div className="p-6 md:p-8 font-mono text-[14px] md:text-[16px] leading-[1.6] overflow-x-auto text-[#151515] dark:text-[#a0a0a0]">
              <div><span className="text-[#166534] dark:text-[#faff69]">{`// Generated via CodeUI Engine`}</span></div>
              <div><span className="text-[#000000] dark:text-white font-bold">import</span> {'{'} <span className="text-[#8b5cf6] dark:text-[#f4f692]">Button</span> {'}'} <span className="text-[#000000] dark:text-white font-bold">from</span> <span className="text-[#166534]">"@/components/ui/button"</span>;</div>
              <br />
              <div><span className="text-[#000000] dark:text-white font-bold">export function</span> <span className="text-[#8b5cf6] dark:text-[#f4f692]">FeatureCard</span>() {'{'}</div>
              <div className="ml-4"><span className="text-[#000000] dark:text-white font-bold">return</span> (</div>
              <div className="ml-8"><span className="text-[#000000] dark:text-white font-bold">&lt;div</span> <span className="text-[#166534] dark:text-[#faff69]">className</span>=<span className="text-[#166534]">"bg-[#141414] border border-[#414141]/80 p-8 rounded-[8px]"</span><span className="text-[#000000] dark:text-white font-bold">&gt;</span></div>
              <div className="ml-12"><span className="text-[#000000] dark:text-white font-bold">&lt;h3</span> <span className="text-[#166534] dark:text-[#faff69]">className</span>=<span className="text-[#166534]">"text-[24px] font-bold text-white mb-4"</span><span className="text-[#000000] dark:text-white font-bold">&gt;</span></div>
              <div className="ml-16"><span className="text-[#151515] dark:text-white font-bold">Absolute Precision</span></div>
              <div className="ml-12"><span className="text-[#000000] dark:text-white font-bold">&lt;/h3&gt;</span></div>
              <div className="ml-12"><span className="text-[#000000] dark:text-white font-bold">&lt;p</span> <span className="text-[#166534] dark:text-[#faff69]">className</span>=<span className="text-[#166534]">"text-[#a0a0a0]"</span><span className="text-[#000000] dark:text-white font-bold">&gt;</span></div>
              <div className="ml-16"><span className="text-[#151515] dark:text-white font-bold">Every pixel, perfectly aligned out of the box.</span></div>
              <div className="ml-12"><span className="text-[#000000] dark:text-white font-bold">&lt;/p&gt;</span></div>
              <div className="ml-8"><span className="text-[#000000] dark:text-white font-bold">&lt;/div&gt;</span></div>
              <div className="ml-4 font-bold">);</div>
              <div className="font-bold">{'}'}</div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="mt-32">
          <div className="uppercase tracking-[1.4px] text-[#585858] dark:text-[#a0a0a0] text-[14px] font-bold mb-6">
            Core Architecture
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Zap className="w-6 h-6 text-[#166534] dark:text-[#faff69]" />}
              title="Real-Time Engine"
              description="Powered by the fastest LLMs to stream component structures in milliseconds. You talk, it writes."
            />
            <FeatureCard 
              icon={<Code2 className="w-6 h-6 text-[#166534] dark:text-[#faff69]" />}
              title="Clean React"
              description="Yields standard React hooks, states, and props. No bloated wrap-arounds or lock-in components."
            />
            <FeatureCard 
              icon={<Layout className="w-6 h-6 text-[#166534] dark:text-[#faff69]" />}
              title="Tailwind Native"
              description="Uses utility classes for styling. Fits perfectly into your existing design system configurations."
            />
            <FeatureCard 
              icon={<MonitorSmartphone className="w-6 h-6 text-[#166534] dark:text-[#faff69]" />}
              title="Fluid Responsive"
              description="By default, every block generated is mobile-first, tablet-ready, and ultra-wide capable."
            />
            <FeatureCard 
              icon={<Layers className="w-6 h-6 text-[#166534] dark:text-[#faff69]" />}
              title="Radix & Shadcn"
              description="Seamlessly implements accessible, unstyled primitives alongside your brand requirements."
            />
            <FeatureCard 
              icon={<Terminal className="w-6 h-6 text-[#166534] dark:text-[#faff69]" />}
              title="Terminal-Grade"
              description="Export your code instantly or preview inline. The tooling gets out of your way."
            />
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="mt-48 pt-16 border-t border-[#e5e7eb] dark:border-[#414141]/80 transition-colors">
          <div className="uppercase tracking-[1.4px] text-[#585858] dark:text-[#a0a0a0] text-[14px] font-bold mb-6">
            Pricing Plans
          </div>
          <h2 className="text-[48px] md:text-[64px] font-black leading-none text-[#000000] dark:text-white max-w-2xl mb-12 tracking-tight">
            PREDICTABLE. SCALABLE.
          </h2>
          
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {pricingPlans.map((plan) => {
              const accentClasses = plan.isHighlighted
                ? "bg-[#ffffff] dark:bg-[#0a0a0a] border-2 dark:border border-[#166534] dark:border-[#faff69] shadow-[0px_4px_25px_rgba(22,101,52,0.05)_inset] dark:shadow-[0px_4px_25px_rgba(250,255,105,0.05)_inset]"
                : "bg-[#f9f9f9] dark:bg-[#141414] border border-[#e5e7eb] dark:border-[#414141]/80"

              return (
                <div key={plan.id} className={`${accentClasses} rounded-[8px] p-10 flex flex-col relative transition-colors hover:border-[#000000] hover:dark:border-[#faff69]/50`}>
                  {plan.isHighlighted && (
                    <div className="absolute top-0 right-0 bg-[#166534] dark:bg-[#faff69] text-[#ffffff] dark:text-[#151515] px-4 py-1 text-[12px] font-bold uppercase tracking-[1.4px] rounded-tr-[5px] rounded-bl-[4px]">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-[24px] font-bold text-[#000000] dark:text-white mb-2">{plan.name}</h3>
                  <div className="flex items-end gap-2 mb-6">
                    <span className={`text-[56px] font-black leading-none ${plan.isHighlighted ? "text-[#166534] dark:text-[#faff69]" : "text-[#000000] dark:text-white"}`}>
                      ${plan.priceMonthly}
                    </span>
                    <span className="text-[#585858] dark:text-[#a0a0a0] font-bold pb-2">/ month</span>
                  </div>
                  <p className="text-[#585858] dark:text-[#a0a0a0] mb-4 min-h-[48px] font-medium">{plan.description}</p>
                  <p className="mb-8 text-[12px] font-bold uppercase tracking-[0.18em] text-[#166534] dark:text-[#faff69]">
                    {plan.monthlyCredits} monthly credits
                  </p>
                  {!session ? (
                    <button
                      onClick={showSignIn}
                      className={`w-full rounded px-6 py-3 mb-8 transition-colors active:scale-[0.98] ${plan.isHighlighted ? "bg-[#faff69] text-[#151515] border border-[#161600] dark:border-[#faff69] font-black hover:bg-[#e0e64c] dark:hover:bg-[#1d1d1d] dark:hover:text-[#faff69]" : "bg-transparent text-[#000000] dark:text-[#ffffff] border border-[#000000] dark:border-[#4f5100] font-bold hover:bg-[#e5e7eb] dark:hover:bg-[#3a3a3a]"}`}
                    >
                      {plan.id === "free" ? "Start Free" : "Sign In to Upgrade"}
                    </button>
                  ) : (
                    <Link href="/dashboard" className="w-full">
                      <span className={`flex w-full items-center justify-center rounded px-6 py-3 mb-8 transition-colors active:scale-[0.98] ${plan.isHighlighted ? "bg-[#faff69] text-[#151515] border border-[#161600] dark:border-[#faff69] font-black hover:bg-[#e0e64c] dark:hover:bg-[#1d1d1d] dark:hover:text-[#faff69]" : "bg-transparent text-[#000000] dark:text-[#ffffff] border border-[#000000] dark:border-[#4f5100] font-bold hover:bg-[#e5e7eb] dark:hover:bg-[#3a3a3a]"}`}>
                        {plan.id === "free" ? "Go to Dashboard" : "Manage Plan in Dashboard"}
                      </span>
                    </Link>
                  )}
                  <ul className="space-y-4 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-[#151515] dark:text-[#ffffff] font-bold">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${plan.isHighlighted ? "bg-[#166534] dark:bg-[#faff69]" : "bg-[#000000] dark:bg-[#faff69]"}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#e5e7eb] dark:border-[#414141]/80 py-16 bg-[#ffffff] dark:bg-[#000000] transition-colors">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 shrink-0">
              <svg viewBox="0 0 375 375" className="w-full h-full dark:hidden">
                <rect x="-37.5" y="-37.5" width="450" height="450" fill="#ffffff" />
                <path fill="#000000" d="M 300 150 L 225 150 L 225 225 L 300 225 L 300 300 L 225 300 L 225 225 L 150 225 L 150 300 L 75 300 L 75 225 L 150 225 L 150 150 L 75 150 L 75 75 L 150 75 L 150 150 L 225 150 L 225 75 L 300 75 Z M 300 0 L 0 0 L 0 375 L 375 375 L 375 0 L 300 0" />
              </svg>
              <svg viewBox="0 0 375 375" className="w-full h-full hidden dark:block">
                <rect x="-37.5" y="-37.5" width="450" height="450" fill="#000000" />
                <path fill="#faff69" d="M 300 150 L 225 150 L 225 225 L 300 225 L 300 300 L 225 300 L 225 225 L 150 225 L 150 300 L 75 300 L 75 225 L 150 225 L 150 150 L 75 150 L 75 75 L 150 75 L 150 150 L 225 150 L 225 75 L 300 75 Z M 300 0 L 0 0 L 0 375 L 375 375 L 375 0 L 300 0" />
              </svg>
            </div>
            <span className="text-[16px] font-black tracking-tight text-[#000000] dark:text-white hover:text-[#166534] dark:hover:text-[#faff69] transition-colors cursor-pointer">CodeUI</span>
          </div>
          
          <div className="flex gap-8 text-[14px] font-bold text-[#585858] dark:text-[#a0a0a0]">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer" : undefined}
                className="hover:text-[#000000] dark:hover:text-[#faff69] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          
          <p className="text-[#585858] dark:text-[#a0a0a0] text-[14px] font-bold">
            © 2026 CodeUI.
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-[8px] border border-[#e5e7eb] dark:border-[#414141]/80 bg-[#f9f9f9] dark:bg-[#141414] hover:bg-[#ffffff] hover:dark:bg-[#1a1a1a] hover:border-[#166534] hover:dark:border-[#faff69]/40 transition-all group flex flex-col">
      <div className="mb-6 opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-transform origin-left">
        {icon}
      </div>
      <h3 className="text-[24px] font-bold text-[#000000] dark:text-[#ffffff] mb-3 leading-[1.3]">{title}</h3>
      <p className="text-[#585858] dark:text-[#a0a0a0] text-[16px] leading-[1.5] font-medium">
        {description}
      </p>
    </div>
  )
}