import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Klokrs vs RescueTime — Free Automatic Time Tracker Alternative",
  description:
    "Comparing Klokrs and RescueTime: automatic tab tracking, pricing, AI insights, and planning tools. See where each tool wins before you switch.",
  alternates: {
    canonical: "/vs/rescuetime",
  },
};

const ROWS: { feature: string; klokrs: string; rescuetime: string }[] = [
  { feature: "Price to get started", klokrs: "Free", rescuetime: "$6.50/mo for full features" },
  { feature: "Automatic tracking, no timers", klokrs: "Yes", rescuetime: "Yes" },
  { feature: "Runs in your browser (no desktop app required)", klokrs: "Yes", rescuetime: "Desktop app + browser extension" },
  { feature: "Ask AI about your time in plain English", klokrs: "Yes, bring your own key", rescuetime: "No" },
  { feature: "Daily planner mapped to tracked time", klokrs: "Yes", rescuetime: "No" },
  { feature: "Automatic distraction blocking, no toggle", klokrs: "Yes, schedule-aware", rescuetime: "Manual FocusTime sessions" },
  { feature: "Built-in Pomodoro focus timer", klokrs: "Yes", rescuetime: "FocusTime blocking only" },
  { feature: "Domain drill-down + 90-day heatmap", klokrs: "Yes", rescuetime: "Yes" },
  { feature: "PDF & CSV export", klokrs: "Yes", rescuetime: "Yes" },
];

export default function KlokrsVsRescueTimePage() {
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
            Looking for a RescueTime alternative?
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/55">
            RescueTime pioneered automatic time tracking, and it's still a solid tool. Klokrs takes
            the same silent, automatic approach but runs entirely in the browser, adds AI-powered
            insights, and bundles planning tools RescueTime doesn't offer — all for free.
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
                  <th className="px-4 py-3 font-medium text-white/50">RescueTime</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.feature} className="border-b border-white/[0.05] last:border-0">
                    <td className="px-4 py-3 text-white/70">{row.feature}</td>
                    <td className="px-4 py-3 font-medium text-violet-200">{row.klokrs}</td>
                    <td className="px-4 py-3 text-white/55">{row.rescuetime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/30">
            RescueTime pricing and features based on their publicly listed plans as of 2026.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white/90">Where Klokrs wins</h2>
          <ul className="ml-5 list-disc space-y-2 text-sm leading-relaxed text-white/60">
            <li>
              <span className="text-white/80">It's free.</span> RescueTime's automatic tracking and
              reporting features sit behind a $6.50/mo subscription. Klokrs is free while in beta,
              and current features stay free for early users.
            </li>
            <li>
              <span className="text-white/80">No desktop app to install.</span> Klokrs is a Chrome
              extension plus a web dashboard — nothing to download or keep running in the background.
            </li>
            <li>
              <span className="text-white/80">Ask AI about your own data.</span> Connect your own
              OpenAI, Gemini, Anthropic, or OpenRouter key and ask plain-English questions about how
              you spend your time. RescueTime has no equivalent.
            </li>
            <li>
              <span className="text-white/80">Built-in planning, not just reporting.</span> The Daily
              Planner maps your intended schedule against what you actually did, and a Pomodoro timer
              is built in. RescueTime is reporting-only, plus basic FocusTime site blocking.
            </li>
            <li>
              <span className="text-white/80">Blocking that follows your schedule, not a manual switch.</span> Set
              an always-blocked list once in Settings, then tag any planner task with sites to block
              only during that task's window — it enforces itself and lifts automatically when the
              window ends. RescueTime's FocusTime is a manual session you start by hand.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white/90">Where RescueTime wins</h2>
          <ul className="ml-5 list-disc space-y-2 text-sm leading-relaxed text-white/60">
            <li>
              <span className="text-white/80">Cross-app desktop tracking.</span> RescueTime tracks
              time across native desktop apps (like Slack or a code editor), not just browser tabs.
              Klokrs currently tracks browser tab activity only.
            </li>
            <li>
              <span className="text-white/80">Longer track record.</span> RescueTime has been
              refining its category-based productivity scoring for over a decade. Klokrs is newer
              and still expanding its feature set.
            </li>
            <li>
              <span className="text-white/80">Mobile app.</span> RescueTime offers a mobile app for
              tracking phone usage; Klokrs is browser-only today.
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
