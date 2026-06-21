import { Settings2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EnvSettingsForm } from "@/components/admin/env-settings-form"
import { requireAdminPage } from "@/lib/admin/guards"
import { hasAdminPermission } from "@/lib/admin/rbac"
import { getEnvSettings } from "@/lib/admin/env-settings"

export const dynamic = "force-dynamic"

export default async function AdminSettingsPage() {
  const session = await requireAdminPage("admin:manage-settings")
  const settings = await getEnvSettings()
  const canManage = hasAdminPermission({
    role: session.user.role,
    permission: "admin:manage-settings",
    resolvedPermissions: session.user.permissions,
  })

  const configuredCount = settings.filter((s) => s.hasValue).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#E7E7E9]">Settings</h1>
        <p className="mt-1 text-sm text-[#9B9B9F]">
          AI provider keys and upstream timeouts. Changes write to{" "}
          <code className="rounded bg-[#1B1B1F] px-1 py-0.5 text-xs">.env.local</code>{" "}
          and apply immediately — no restart needed.
        </p>
      </div>

      <section className="rounded-lg border border-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-[#9B9B9F]" />
          <div>
            <p className="text-xs text-[#9B9B9F]">Environment</p>
            <h2 className="text-sm font-medium text-[#E7E7E9]">
              AI provider keys &amp; timeouts
            </h2>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {configuredCount}/{settings.length} set
          </Badge>
        </div>
        <div className="mt-5">
          <EnvSettingsForm
            settings={settings}
            readOnly={!canManage}
            readOnlyReason={
              canManage
                ? undefined
                : "Your role can review these settings but cannot change them."
            }
          />
        </div>
      </section>
    </div>
  )
}
