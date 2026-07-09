import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Klokrs vs Toggl Track — Automatic vs Manual Time Tracking",
  description:
    "Comparing Klokrs and Toggl Track: automatic tab tracking vs manual timers, pricing, AI insights, and planning tools. See where each tool wins.",
  alternates: {
    canonical: "/vs/toggl",
  },
};

const ROWS: { feature: string; klokrs: string; toggl: string }[] = [
  { feature: "Price to get started", klokrs: "Free", toggl: "Free tier, $9+/mo for teams" },
  { feature: "Automatic tracking, no timers", klokrs: "Yes", toggl: "No — manual start/stop timers" },
  { feature: "Runs in your browser", klokrs: "Yes", toggl: "Yes, plus desktop and mobile apps" },
  { feature: "Ask AI about your time in plain English", klokrs: "Yes, bring your own key", toggl: "No" },
  { feature: "Daily planner mapped to tracked time", klokrs: "Yes", toggl: "Project-based time entries only" },
  { feature: "Automatic distraction blocking, no toggle", klokrs: "Yes, schedule-aware", toggl: "No" },
  { feature: "Built-in Pomodoro focus timer", klokrs: "Yes", toggl: "No" },
  { feature: "Domain drill-down + 90-day heatmap", klokrs: "Yes", toggl: "Reports by project/client, no domain view" },
  { feature: "PDF & CSV export", klokrs: "Yes", toggl: "Yes" },
];

export default function KlokrsVsTogglPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <div className="mb-12">
          <div className="mb-4 h-px w-full bg-gradient-to-r from-violet-500/20 via-white/[0.06] to-transparent" />
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-400/80">
            Comparison
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white/95 sm:text-4xl">
            Looking for a free Toggl alternative?
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/55">
            Toggl Track is built around manual timers — you start one when you begin a task and stop
            it when you're done. Klokrs takes the opposite approach: it tracks automatically from
            the moment you install it, so there's nothing to remember to start.
          </p>
        </div>

        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white/90">Quick comparison</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-left">
                  <th className="px-4 py-3 font-medium text-white/50">Feature</th>
                  <th className="px-4 py-3 font-semibold text-violet-300">Klokrs</th>
                  <th className="px-4 py-3 font-medium text-white/50">Toggl Track</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.feature} className="border-b border-white/[0.05] last:border-0">
                    <td className="px-4 py-3 text-white/70">{row.feature}</td>
                    <td className="px-4 py-3 font-medium text-violet-200">{row.klokrs}</td>
                    <td className="px-4 py-3 text-white/55">{row.toggl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/30">
            Toggl Track pricing and features based on their publicly listed plans as of 2026.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white/90">Where Klokrs wins</h2>
          <ul className="ml-5 list-disc space-y-2 text-sm leading-relaxed text-white/60">
            <li>
              <span className="text-white/80">Nothing to remember.</span> Toggl only tracks time you
              remember to start a timer for — if you forget, that time isn't logged. Klokrs tracks
              every tab automatically, so your data reflects what actually happened.
            </li>
            <li>
              <span className="text-white/80">Free, no per-seat pricing.</span> Toggl's free tier is
              limited and team plans are priced per seat. Klokrs is free while in beta, with no
              per-user billing.
            </li>
            <li>
              <span className="text-white/80">Ask AI about your own data.</span> Connect your own
              OpenAI, Gemini, Anthropic, or OpenRouter key and ask plain-English questions about your
              tracked time. Toggl has no equivalent.
            </li>
            <li>
              <span className="text-white/80">Built-in planning and focus tools.</span> The Daily
              Planner and Pomodoro timer are built in. Toggl Track is a pure time-logging tool with
              no planning layer.
            </li>
            <li>
              <span className="text-white/80">Blocks distracting sites on its own.</span> Tag a
              planner task with sites to block and it enforces itself only during that task's window,
              plus an always-blocked list for the sites you never want open. Toggl has no site-blocking
              feature at all.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white/90">Where Toggl wins</h2>
          <ul className="ml-5 list-disc space-y-2 text-sm leading-relaxed text-white/60">
            <li>
              <span className="text-white/80">Built for client billing.</span> Toggl's project,
              client, and billable-rate structure is purpose-built for freelancers and agencies
              invoicing clients by the hour. Klokrs doesn't have a billing/invoicing workflow.
            </li>
            <li>
              <span className="text-white/80">Cross-platform apps.</span> Toggl has desktop and
              mobile apps that track time outside the browser. Klokrs currently tracks browser tab
              activity only.
            </li>
            <li>
              <span className="text-white/80">Team collaboration features.</span> Toggl supports team
              workspaces, shared projects, and approvals. Klokrs is currently built for individual use.
            </li>
          </ul>
        </section>

        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-6 text-center">
          <p className="mb-4 text-sm text-white/70">
            Try Klokrs free — install the extension and see your first report today.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:from-violet-500 hover:to-violet-400 hover:shadow-[0_0_25px_rgba(124,58,237,0.6)]"
          >
            Get started free
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
