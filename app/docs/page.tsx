import Link from "next/link"
import { SITE_LINKS, SITE_NAME } from "@/lib/site-config"

export const metadata = {
  title: `Documentation | ${SITE_NAME}`,
  description: "Learn how to start projects, iterate with AI, and manage exports in CodeUI.",
}

const sections = [
  {
    title: "Start a project",
    body: "Use the dashboard prompt box to generate a new interface or create a blank project when you want full manual control.",
  },
  {
    title: "Iterate with AI",
    body: "Continue refining generated HTML with follow-up prompts, version history, and targeted design-mode edits.",
  },
  {
    title: "Export and ship",
    body: "Preview, copy, or export the generated output when the interface is ready for integration into your app.",
  },
] as const

export default function DocumentationPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-zinc-950 dark:bg-black dark:text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-white/10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              Documentation
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Build faster with {SITE_NAME}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              This quick-start guide covers the core workflow for generating projects, editing output, and managing privacy, billing, and exports.
            </p>
          </div>
          <Link
            href={SITE_LINKS.discover}
            className="rounded border border-zinc-900 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-[#faff69] dark:hover:bg-[#141414]"
          >
            Explore public projects
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-white/10 dark:bg-[#111111]">
              <h2 className="text-lg font-bold">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{section.body}</p>
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-lg border border-zinc-200 p-6 dark:border-white/10">
          <h2 className="text-lg font-bold">Core workflow</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            <li>1. Create a project from the dashboard using a prompt or a blank canvas.</li>
            <li>2. Refine the generated interface with follow-up prompts, design mode, or direct code edits.</li>
            <li>3. Save checkpoints, preview on multiple breakpoints, and export when the result is ready.</li>
          </ol>
        </section>
      </div>
    </main>
  )
}
