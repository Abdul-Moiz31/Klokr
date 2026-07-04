"use client";

import { motion } from "framer-motion";
import type { DayPhase } from "@/lib/prefs";

// Shown on the dashboard when a returning user (one who has tracked before)
// simply has no data yet for today. Unlike ActivationChecklist, this never
// tells them to "add the extension" or "sign in" — they've already done
// that, possibly for months. It just sets expectations for today.

interface Props {
  dayPhase: DayPhase;
  workStartHour: number;
}

function formatHour12(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

export function NoActivityToday({ dayPhase, workStartHour }: Props) {
  // Only claim tracking is "live" when it actually is — before the work
  // window starts or after it ends, nothing is being recorded.
  const isLive = dayPhase === "active";

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
            {isLive && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 opacity-75" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-white/25"}`} />
          </span>
          <p className={`text-xs font-semibold uppercase tracking-widest ${isLive ? "text-emerald-300/80" : "text-white/40"}`}>
            {isLive ? "Tracking is live" : dayPhase === "pending" ? "Tracking not started" : "Tracking paused"}
          </p>
        </div>
        <h3 className="text-xl font-bold text-white">No activity yet today</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/50">
          {dayPhase === "pending"
            ? `Your workday starts at ${formatHour12(workStartHour)} — this fills in automatically once it does.`
            : dayPhase === "complete"
              ? "Your work window for today has ended. Nothing to do here."
              : "Klokrs hasn't seen any browsing yet — this fills in automatically as you work."}
        </p>
      </div>
    </motion.div>
  );
}
