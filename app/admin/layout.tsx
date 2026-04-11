import { Badge } from "@/components/ui/badge"
import { UserMenu } from "@/components/user-menu"
import { AdminSidebar } from "@/components/admin/sidebar"
import { requireAdminPage } from "@/lib/admin/guards"

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
    <div className="h-screen w-screen overflow-hidden bg-[#060608] font-sans text-[#E6E7E8]">
      <div className="flex h-full w-full">
        <AdminSidebar user={session.user} />

        <main className="flex min-w-0 flex-1 flex-col bg-[#060608]">
          <header className="z-10 border-b border-white/5 bg-[#060608]/95 backdrop-blur-sm">
            <div className="flex h-16 items-center justify-between gap-4 px-6 sm:px-8">
              <div className="flex items-center gap-4">
                <div className="hidden lg:block h-8 w-[1px] bg-white/5 mx-2" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#A6A6A6]">
                    Back Office
                  </p>
                  <h2 className="text-sm font-medium text-white sm:text-base">
                    Admin Control Panel
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="hidden border-white/10 text-[#D6D8DA] sm:inline-flex">
                  {formatRoleLabel(session.user.role)}
                </Badge>
                <UserMenu />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden">
            <div className="h-full w-full overflow-y-auto scrollbar-hide px-6 py-6 sm:px-8 sm:py-8">
              <div className="mx-auto max-w-[1600px] h-full flex flex-col">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}