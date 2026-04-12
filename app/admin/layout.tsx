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
    <div className="h-screen w-screen overflow-hidden bg-[#000000] font-sans text-white selection:bg-[#faff69]/20 selection:text-[#faff69]">
      <div className="flex h-full w-full">
        <AdminSidebar user={session.user} />

        <main className="flex min-w-0 flex-1 flex-col bg-[#000000]">
          <header className="z-10 border-b border-[#414141]/80 bg-[#000000]">
            <div className="flex h-20 items-center justify-between gap-4 px-8 sm:px-12 bg-[#000000]">
              <div className="flex items-center gap-6">
                <div className="hidden lg:block h-10 w-[1px] bg-[#414141]/80 mx-2" />
                <div>
                  <p className="text-[14px] font-semibold uppercase tracking-[1.4px] text-[#a0a0a0] mb-1">
                    Back Office
                  </p>
                  <h2 className="text-[24px] font-bold text-white sm:text-[28px] uppercase tracking-tight">
                    Admin Control Panel
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="hidden text-[14px] font-bold uppercase tracking-[1.4px] border border-[#a0a0a0] text-white px-4 py-1.5 rounded-[4px] sm:inline-flex">
                  {formatRoleLabel(session.user.role)}
                </span>
                <UserMenu />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0 bg-[#000000]" />
            <div className="h-full w-full overflow-y-auto scrollbar-hide relative z-10 px-8 py-10 sm:px-12 sm:py-12">
              <div className="mx-auto max-w-[2200px] h-full flex flex-col">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
