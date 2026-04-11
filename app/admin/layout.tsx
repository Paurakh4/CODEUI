import Link from "next/link"
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
import { Badge } from "@/components/ui/badge"
import { UserMenu } from "@/components/user-menu"
import { requireAdminPage } from "@/lib/admin/guards"

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

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await requireAdminPage("admin:access")

  return (
    <div className="min-h-screen bg-[#060608] text-[#E6E7E8] font-sans">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-white/5 bg-[#08090A] lg:flex lg:flex-col sticky top-0 h-screen">
          <div className="px-6 py-8">
            <Link href="/dashboard" className="flex items-center gap-2.5 mb-8 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white transition-colors group-hover:bg-white/10">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-white uppercase tracking-[0.2em]">Admin</span>
            </Link>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#A6A6A6] transition-all hover:bg-white/[0.03] hover:text-white group"
                  >
                    <Icon className="h-4 w-4 transition-colors group-hover:text-[#0AA6FF]" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="mt-auto border-t border-white/5 p-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#A6A6A6] transition-all hover:bg-white/[0.03] hover:text-white group"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Exit Admin
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#060608]">
          <header className="h-16 border-b border-white/5 bg-[#08090A]/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-medium text-[#A6A6A6]">Admin Control Panel</h2>
            </div>
            <div className="flex items-center gap-4">
              <UserMenu />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-8">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}              )
            })}
          </nav>

          <div className="space-y-4 border-t border-white/6 px-6 py-6">
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">
                Access
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge className="border-[#0AA6FF]/30 bg-[#0AA6FF]/10 text-[#7FD0FF] hover:bg-[#0AA6FF]/10">
                  {formatRoleLabel(session.user.role)}
                </Badge>
                <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
                  {session.user.permissions.length} permissions
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-white">
                {session.user.name || session.user.email}
              </p>
              <p className="mt-1 text-sm text-[#A6A6A6]">
                {session.user.email}
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/6 bg-[#060608]/90 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">
                  Back Office
                </p>
                <h2 className="text-xl font-semibold tracking-tight text-white">
                  Admin Control Panel
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="hidden border-white/10 text-[#D6D8DA] sm:inline-flex">
                  {formatRoleLabel(session.user.role)}
                </Badge>
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  )
}