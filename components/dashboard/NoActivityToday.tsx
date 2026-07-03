"use client";

import { motion } from "framer-motion";

// Shown on the dashboard when a returning user (one who has tracked before)
// simply has no data yet for today. Unlike ActivationChecklist, this never
// tells them to "add the extension" or "sign in" — they've already done
// that, possibly for months. It just sets expectations for today.

export function NoActivityToday() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8 text-center"
    >
      <div className="mx-auto max-w-md">
        <div className="mb-1 flex items-center justify-center gap-2">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300/80">Tracking is live</p>
        </div>
        <h3 className="text-xl font-bold text-white">No activity yet today</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/50">
          Klokrs hasn&apos;t seen any browsing yet — this fills in automatically as you work.
          Nothing to do here.
        </p>
      </div>
    </motion.div>
  );
}
