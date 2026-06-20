"use client"

import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { Command, Moon, Sun } from "lucide-react"

function formatBreadcrumb(path: string) {
  const segments = path.split("/").filter(Boolean).slice(1)
  if (segments.length === 0) return "Overview"
  return segments
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " "))
    .join(" / ")
}

interface AdminHeaderProps {
  user: {
    name?: string | null
    email?: string | null
    role: string
    permissions?: string[]
  }
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const breadcrumb = formatBreadcrumb(pathname)

  return (
    <header className="flex h-12 items-center justify-between gap-4 border-b border-white/[0.04] bg-background px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg" />
        <span className="hidden text-sm text-[#9B9B9F] sm:inline-block">
          {breadcrumb}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F]"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
        >
          <Command className="h-3.5 w-3.5" />
          <kbd className="hidden text-xs sm:inline-flex">⌘K</kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F]"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        <span className="rounded-md border border-white/[0.04] bg-[#1B1B1F] px-2 py-0.5 text-xs text-[#9B9B9F]">
          {user.role}
        </span>
        <UserMenu />
      </div>
    </header>
  )
}
