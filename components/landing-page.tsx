"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, Code2, Zap, Layout } from "lucide-react"
import Link from "next/link"
import { useAuthDialog } from "@/components/auth-dialog-provider"
import { useSession } from "next-auth/react"

export function LandingPage() {
  const { showSignIn } = useAuthDialog()
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/20 dark">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white text-black rounded flex items-center justify-center text-lg font-bold">
            C
          </div>
          <span className="text-xl font-bold tracking-tight">CodeUI</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#showcase" className="hover:text-white transition-colors">Showcase</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-4">
          {!session ? (
            <Button 
              variant="ghost" 
              className="text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full px-4"
              onClick={showSignIn}
            >
              Sign In
            </Button>
          ) : (
            <Link href="/dashboard">
              <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full px-4">Dashboard</Button>
            </Link>
          )}
          <Link href="/dashboard">
            <Button className="bg-white text-black hover:bg-zinc-200 rounded-full px-6 transition-colors">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-zinc-400">
            <Sparkles className="w-3 h-3 text-yellow-500" />
            <span>AI-Powered UI Generation is here</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter max-w-4xl mx-auto leading-[0.9]">
            Build beautiful UIs with <span className="text-zinc-500">just a prompt.</span>
          </h1>
          
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto">
            CodeUI transforms your ideas into production-ready React components using the world's most advanced AI models.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <Link href="/dashboard">
              <Button size="lg" className="bg-white text-black hover:bg-zinc-200 rounded-full px-8 h-14 text-lg gap-2">
                Start Building <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="bg-zinc-900/50 border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-full px-8 h-14 text-lg transition-all">
              View Showcase
            </Button>
          </div>
        </div>

        {/* Feature Grid */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40">
          <FeatureCard 
            icon={<Zap className="w-6 h-6 text-yellow-500" />}
            title="Instant Generation"
            description="Go from prompt to preview in seconds. Iterate faster than ever before."
          />
          <FeatureCard 
            icon={<Code2 className="w-6 h-6 text-blue-500" />}
            title="Production Ready"
            description="Get clean, accessible, and responsive React code that you can use immediately."
          />
          <FeatureCard 
            icon={<Layout className="w-6 h-6 text-purple-500" />}
            title="Full Control"
            description="Edit styles visually or jump into the code. The power is in your hands."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white text-black rounded flex items-center justify-center text-sm font-bold">
              C
            </div>
            <span className="text-lg font-bold tracking-tight">CodeUI</span>
          </div>
          <p className="text-zinc-500 text-sm">
            © 2025 CodeUI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-3xl border border-white/10 bg-white/5 space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center border border-white/10">
        {icon}
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">
        {description}
      </p>
    </div>
  )
}
