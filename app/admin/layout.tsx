import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeader } from "@/components/admin/admin-header"
import { AdminCommandPalette } from "@/components/admin/command-palette"
import { SkipLink } from "@/components/admin/skip-link"
import { requireAdminPage } from "@/lib/admin/guards"

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await requireAdminPage("admin:access")

  return (
    <div className="h-screen w-screen overflow-hidden bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary">
      <SkipLink />
      <SidebarProvider defaultOpen={true} className="h-full">
        <AdminSidebar user={session.user} />
        <SidebarInset className="flex min-h-0 flex-col">
          <AdminHeader user={session.user} />
          <div
            id="main-content"
            className="flex-1 overflow-y-auto min-h-0"
          >
            <div className="mx-auto flex min-h-full max-w-[2200px] flex-col p-4 md:p-6">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <AdminCommandPalette />
    </div>
  )
}
