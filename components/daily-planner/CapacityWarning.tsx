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
          className="mb-3 flex items-center gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] px-3.5 py-2"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-400/70">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-[11px] text-amber-200/65">
            <b className="text-amber-100/90">{fmt(plannedMinutes)}</b> planned today vs your{" "}
            <b className="text-amber-100/90">{fmt(avgMinutes)}</b> daily average — that&apos;s ambitious.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
