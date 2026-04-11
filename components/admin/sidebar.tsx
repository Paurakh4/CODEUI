"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Bot,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react"
import { AdminNavItem } from "@/components/admin/nav-item"

interface AdminSidebarProps {
  user: {
    name?: string | null
    email?: string | null
    role: string
    permissions: string[]
  }
}

const navItems = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Customers",
    href: "/admin/customers",
    icon: Users,
  },
  {
    label: "Projects",
    href: "/admin/projects",
    icon: FolderKanban,
  },
  {
    label: "Billing",
    href: "/admin/billing",
    icon: CreditCard,
  },
  {
    label: "Models",
    href: "/admin/models",
    icon: Bot,
  },
  {
    label: "Audit",
    href: "/admin/audit",
    icon: ScrollText,
  },
]

function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-white/5 bg-[#08090B] lg:flex lg:flex-col shadow-2xl">
      <div className="px-8 py-10">
        <Link href="/dashboard" className="group flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white transition-all group-hover:scale-105 group-hover:bg-white/10 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#71717A]">
              Terminal
            </p>
            <p className="text-lg font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">Admin</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1.5 px-6 py-4">
        {navItems.map((item) => (
          <AdminNavItem key={item.label} item={item} />
        ))}
      </nav>

      <div className="mt-auto space-y-6 px-6 py-8">
        <div className="relative group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04]">
          <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-colors" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#71717A] mb-3">
            Active Identity
          </p>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="text-[13px] font-semibold text-white truncate">
              {user.name || user.email?.split('@')[0]}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge className="border-white/5 bg-white/[0.05] text-[10px] font-bold text-[#A6A6A6] hover:bg-white/[0.1] px-2 py-0">
              {formatRoleLabel(user.role)}
            </Badge>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="group flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-[13px] font-bold uppercase tracking-widest text-[#71717A] transition-all hover:border-white/5 hover:bg-white/[0.02] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Exit Controller
        </Link>
      </div>
    </aside>
  )
}
