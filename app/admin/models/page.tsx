import { Bot } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/admin/stat-card"
import { ModelPolicyForm } from "@/components/admin/model-policy-form"
import { requireAdminPage } from "@/lib/admin/guards"
import { hasAdminPermission } from "@/lib/admin/rbac"
import { getAdminModelCatalog } from "@/lib/admin/model-policies"
import { PXROUTE_SOURCE_PROVIDER } from "@/lib/ai-models"

export default async function AdminModelsPage() {
  const session = await requireAdminPage("admin:view-models")
  const catalog = await getAdminModelCatalog()
  const canManageModels = hasAdminPermission({
    role: session.user.role,
    permission: "admin:manage-models",
    resolvedPermissions: session.user.permissions,
  })
  const enabledCount = catalog.models.filter((model) => model.enabled).length
  const reasoningCount = catalog.models.filter((model) => model.supportsReasoning).length
  const pxRouteCount = catalog.models.filter((model) => model.sourceProvider === PXROUTE_SOURCE_PROVIDER).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#E7E7E9]">Models</h1>
        <p className="mt-1 text-sm text-[#9B9B9F]">
          Runtime model catalog — add models, set visible names, and control default routing.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard title="Enabled" value={enabledCount} icon={Bot} />
        <StatCard title="Reasoning" value={reasoningCount} />
        <StatCard title="PxRoute" value={pxRouteCount} />
        <StatCard
          title="Default Model"
          value={
            catalog.models.find((model) => model.id === catalog.defaultModelId)
              ?.name || catalog.defaultModelId
          }
        />
        <StatCard
          title="Last Updated"
          value={
            catalog.updatedAt
              ? new Date(catalog.updatedAt).toLocaleString()
              : "Not configured yet"
          }
        />
      </div>

      <section className="rounded-lg border border-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-[#9B9B9F]" />
          <div>
            <p className="text-xs text-[#9B9B9F]">Model Catalog</p>
            <h2 className="text-sm font-medium text-[#E7E7E9]">Catalog, availability, and default routing</h2>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {session.user.role}
          </Badge>
        </div>
        <div className="mt-5">
          <ModelPolicyForm
            models={catalog.models}
            defaultModelId={catalog.defaultModelId}
            promptEnhanceModelId={catalog.promptEnhanceModelId}
            readOnly={!canManageModels}
            readOnlyReason={
              canManageModels
                ? undefined
                : "Your role can review model policy but cannot change runtime availability."
            }
          />
        </div>
      </section>
    </div>
  )
}
