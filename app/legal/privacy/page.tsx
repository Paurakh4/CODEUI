import { SITE_NAME } from "@/lib/site-config"

export const metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description: "Privacy information for CodeUI users.",
}

const sections = [
  {
    title: "Information we store",
    body: "CodeUI stores account data, project content, media uploads, and billing-related identifiers needed to operate the product and support your workspace.",
  },
  {
    title: "How we use it",
    body: "We use stored data to authenticate users, persist projects, process billing, provide support, and improve reliability and product quality.",
  },
  {
    title: "Your controls",
    body: "You can delete projects from the dashboard, manage account preferences in settings, and contact support if you need account-level data assistance.",
  },
] as const

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-zinc-950 dark:bg-black dark:text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Privacy Policy</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          This policy describes the core categories of data handled by {SITE_NAME} and the operational reasons for collecting it.
        </p>

        <div className="mt-10 space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-zinc-200 p-6 dark:border-white/10">
              <h2 className="text-lg font-bold">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
