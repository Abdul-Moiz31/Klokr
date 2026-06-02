"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useDailyAverage } from "@/lib/daily-planner/useDailyAverage";

type Props = {
  userId: string | null;
  /** Total planned minutes for today (sum of scheduled task windows). */
  plannedMinutes: number;
};

function fmt(min: number): string {
  const total = Math.round(min);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Only warn when we have a few days of history AND the plan is meaningfully
// above the user's real average. The 1.25× factor avoids nagging on normal days.
const MIN_ACTIVE_DAYS = 3;
const OVERCOMMIT_FACTOR = 1.25;

export function CapacityWarning({ userId, plannedMinutes }: Props) {
  const { avgMinutes, activeDays, loading } = useDailyAverage(userId);

  const show =
    !loading &&
    avgMinutes != null &&
    activeDays >= MIN_ACTIVE_DAYS &&
    plannedMinutes > 0 &&
    plannedMinutes > avgMinutes * OVERCOMMIT_FACTOR;

  return (
    <AnimatePresence>
      {show && avgMinutes != null && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <p className="text-xs leading-relaxed text-amber-200/80">
            You&apos;ve planned <b className="text-amber-100">{fmt(plannedMinutes)}</b> today, but your
            recent daily average is <b className="text-amber-100">{fmt(avgMinutes)}</b> of tracked focus.
            That&apos;s ambitious — consider trimming a block or two so the plan stays realistic.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
