import { Bot, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ModelPolicyForm } from "@/components/admin/model-policy-form"
import { requireAdminPage } from "@/lib/admin/guards"
import { hasAdminPermission } from "@/lib/admin/rbac"
import { getAdminModelCatalog } from "@/lib/admin/model-policies"

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

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(10,166,255,0.14),_transparent_38%),linear-gradient(180deg,_rgba(15,17,19,0.98),_rgba(9,10,11,0.98))] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Models Module</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Runtime model access is now admin-controlled.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C3C7CB] sm:text-base">
              This policy now drives the public model list, AI route validation, and default model selection for authenticated user settings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Enabled</p>
              <p className="mt-2 text-2xl font-semibold text-white">{enabledCount}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Reasoning</p>
              <p className="mt-2 text-2xl font-semibold text-white">{reasoningCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Default Model</p>
          <p className="mt-3 text-lg font-semibold text-white">{
            catalog.models.find((model) => model.id === catalog.defaultModelId)?.name || catalog.defaultModelId
          }</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Last Updated</p>
          <p className="mt-3 text-lg font-semibold text-white">
            {catalog.updatedAt ? new Date(catalog.updatedAt).toLocaleString() : "Not configured yet"}
          </p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Updated By</p>
          <p className="mt-3 text-lg font-semibold text-white">{catalog.updatedByEmail || "System defaults"}</p>
        </article>
      </section>

      <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Policy Editor</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Availability and default routing</h2>
          </div>
          <Badge className="ml-auto border-[#0AA6FF]/30 bg-[#0AA6FF]/10 text-[#7FD0FF] hover:bg-[#0AA6FF]/10">
            {session.user.role}
          </Badge>
        </div>

        <div className="mt-6">
          <ModelPolicyForm
            models={catalog.models}
            defaultModelId={catalog.defaultModelId}
            readOnly={!canManageModels}
            readOnlyReason={
              canManageModels
                ? undefined
                : "Your role can review model policy but cannot change runtime availability."
            }
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Catalog</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Available model inventory</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {catalog.models.map((model) => (
            <article key={model.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-white">{model.name}</p>
                {model.enabled ? (
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10">Enabled</Badge>
                ) : (
                  <Badge variant="outline" className="border-white/10 text-[#A6A6A6]">Disabled</Badge>
                )}
                {model.isDefault ? (
                  <Badge className="border-[#0AA6FF]/30 bg-[#0AA6FF]/10 text-[#7FD0FF] hover:bg-[#0AA6FF]/10">Default</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-[#D6D8DA]">{model.description}</p>
              <p className="mt-3 text-xs text-[#A6A6A6]">
                {model.provider} · {(model.contextLength / 1000).toFixed(0)}K context{model.supportsReasoning ? " · Reasoning" : ""}{model.isFast ? " · Fast" : ""}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}