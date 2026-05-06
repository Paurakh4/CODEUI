"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  ArrowLeft,
  Bot,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Users,
} from "lucide-react"

const COMMANDS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Projects", href: "/admin/projects", icon: FolderKanban },
  { label: "Billing", href: "/admin/billing", icon: CreditCard },
  { label: "Models", href: "/admin/models", icon: Bot },
  { label: "Feedback", href: "/admin/feedback", icon: MessageSquare },
  { label: "Audit", href: "/admin/audit", icon: ScrollText },
  { label: "Exit to Dashboard", href: "/dashboard", icon: ArrowLeft },
]

export function AdminCommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const runCommand = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("open-command-palette", handler)
    return () => window.removeEventListener("open-command-palette", handler)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search admin pages..." />
      <CommandList>
        <CommandEmpty>No pages found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {COMMANDS.map((cmd) => {
            const Icon = cmd.icon
            return (
              <CommandItem key={cmd.href} onSelect={() => runCommand(cmd.href)}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{cmd.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
