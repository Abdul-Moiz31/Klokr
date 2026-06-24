"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loadPrefs } from "@/lib/prefs";

type Props = {
  totalSecondsToday: number;
};

function isPastWorkEnd(workStartHour: number, workEndHour: number): boolean {
  if (workStartHour === workEndHour) return false; // 24h tracking — never "done"
  const hour = new Date().getHours();
  if (workStartHour < workEndHour) {
    // Same-day window: complete after workEndHour, until midnight rollover.
    return hour >= workEndHour;
  }
  // Overnight window (e.g. 22 → 06): complete after workEndHour and before workStartHour.
  return hour >= workEndHour && hour < workStartHour;
}

function formatHours(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WorkDayCompleteBanner({ totalSecondsToday }: Props) {
  const [show, setShow] = useState(false);
  const [productive, setProductive] = useState(false);
  const [productiveHours, setProductiveHours] = useState(4);

  useEffect(() => {
    const prefs = loadPrefs();
    const past = isPastWorkEnd(prefs.workStartHour, prefs.workEndHour);
    if (!past) { setShow(false); return; }

    // Dismissed for the rest of today?
    try {
      const dismissed = sessionStorage.getItem("Klokrs_daycomplete_dismissed");
      if (dismissed === todayKey()) { setShow(false); return; }
    } catch { /* sessionStorage unavailable */ }

    setProductiveHours(prefs.productiveHoursThreshold);
    setProductive(totalSecondsToday >= prefs.productiveHoursThreshold * 3600);
    setShow(true);
  }, [totalSecondsToday]);

  const dismiss = () => {
    try { sessionStorage.setItem("Klokrs_daycomplete_dismissed", todayKey()); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className={`mb-6 flex items-start justify-between gap-4 rounded-xl border px-5 py-4 ${
            productive
              ? "border-emerald-500/25 bg-emerald-500/[0.06]"
              : "border-amber-500/25 bg-amber-500/[0.06]"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              productive ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
            }`}>
              {productive ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${productive ? "text-emerald-200" : "text-amber-200"}`}>
                {productive ? "Today's tracking is complete" : "Today's tracking ended"}
              </p>
              <p className="mt-0.5 text-sm text-white/55 leading-relaxed">
                {productive ? (
                  <>You logged <b className="text-white/80">{formatHours(totalSecondsToday)}</b> today — past your {productiveHours}h goal. Great work, see you tomorrow.</>
                ) : (
                  <>You logged <b className="text-white/80">{formatHours(totalSecondsToday)}</b> today, short of your {productiveHours}h goal. Tomorrow&apos;s a fresh start.</>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white/70"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
