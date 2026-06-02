"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// Shown on the dashboard when a user has no data yet today. Bridges the gap
// between installing the extension and seeing real data (~30 min of browsing):
// confirms what's happening, sets expectations, and gives a productive next
// step so the empty state isn't a dead end.

const STEPS = [
  {
    title: "Account created",
    body: "You're signed in — your tab time will sync to this dashboard automatically.",
    done: true,
  },
  {
    title: "Add the Klokrs extension to Chrome",
    body: "If you haven't yet, install it and keep this tab signed in so the extension can read your session.",
    done: false,
  },
  {
    title: "Browse as usual — data appears here",
    body: "Klokrs tracks silently in the background. Your first domains show up within a minute of browsing; a fuller picture builds over ~30 minutes.",
    done: false,
  },
];

export function ActivationChecklist() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8"
    >
      <div className="mx-auto max-w-xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300/80">Tracking is live</p>
        </div>
        <h3 className="text-xl font-bold text-white">You&apos;re all set — let&apos;s fill this in</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/50">
          No data yet for today. That&apos;s normal on a fresh start — here&apos;s what happens next.
        </p>

        <ol className="mt-6 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-3.5">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "border border-white/15 bg-white/5 text-white/50"
                }`}
              >
                {step.done ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <div>
                <p className={`text-sm font-medium ${step.done ? "text-white/55 line-through" : "text-white/85"}`}>{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/45">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/daily-planner"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            Plan your first day
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="https://chromewebstore.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10"
          >
            Get the extension
          </a>
        </div>

        <p className="mt-4 text-center text-xs text-white/30">
          While you wait — planning your day means Klokrs can show you plan vs actual once your data arrives.
        </p>
      </div>
    </motion.div>
  );
}
