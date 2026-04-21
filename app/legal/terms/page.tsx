import { SITE_NAME } from "@/lib/site-config"

export const metadata = {
  title: `Terms of Service | ${SITE_NAME}`,
  description: "Terms of service for using CodeUI.",
}

const sections = [
  {
    title: "Acceptable use",
    body: "You are responsible for the prompts, projects, and uploads you create in CodeUI and must use the service lawfully and without abusing shared infrastructure.",
  },
  {
    title: "Accounts and billing",
    body: "Paid plans, top-up credits, and usage limits follow the billing configuration shown in-product. Access may change if payments fail or an account is suspended.",
  },
  {
    title: "Service changes",
    body: "We may update product capabilities, limits, or documentation as the platform evolves. Material billing behavior is reflected in the live pricing flows inside the app.",
  },
] as const

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-zinc-950 dark:bg-black dark:text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Terms of Service</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          These terms summarize the main expectations for using {SITE_NAME}, including account access, billing, and platform usage.
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
