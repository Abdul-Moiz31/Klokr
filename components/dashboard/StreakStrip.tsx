"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { loadPrefs } from "@/lib/prefs";
import { calcStreak, countProductiveDays, localDateStr } from "@/lib/streak";

type Props = {
  userId: string | null;
};

type StreakData = {
  streak: number;
  productiveDays: number;
  totalDays: number;
  goalHours: number;
  todayMetGoal: boolean;
};

export function StreakStrip({ userId }: Props) {
  const [data, setData] = useState<StreakData | null>(null);
  const prefs = useMemo(() => loadPrefs(), []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const today = new Date();
      const todayStr = localDateStr(today);
      const from = new Date(today);
      from.setDate(today.getDate() - 90);

      const supabase = createClient();
      const { data: rows } = await supabase
        .from("tab_sessions")
        .select("date, duration_seconds")
        .eq("user_id", userId)
        .gte("date", localDateStr(from))
        .lte("date", todayStr)
        .gte("duration_seconds", prefs.minSessionSeconds);

      if (cancelled || !rows) return;

      const map = new Map<string, number>();
      for (const r of rows) {
        map.set(r.date, (map.get(r.date) ?? 0) + r.duration_seconds);
      }

      const thresholdS = prefs.productiveHoursThreshold * 3600;
      setData({
        streak: calcStreak(map, todayStr),
        productiveDays: countProductiveDays(map, thresholdS),
        totalDays: map.size,
        goalHours: prefs.productiveHoursThreshold,
        todayMetGoal: (map.get(todayStr) ?? 0) >= thresholdS,
      });
    })();

    return () => { cancelled = true; };
  }, [userId, prefs]);

  if (!data) return null;

  const hot = data.streak >= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4"
    >
      <div className="flex items-center gap-5">
        {/* Streak */}
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${hot ? "bg-orange-500/15 text-orange-300" : "bg-violet-500/15 text-violet-300"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </span>
          <div>
            <p className="text-lg font-bold leading-none text-white tabular-nums">
              {data.streak}<span className="ml-0.5 text-sm font-medium text-white/40">day{data.streak === 1 ? "" : "s"}</span>
            </p>
            <p className="mt-1 text-xs text-white/40">
              {data.streak > 0 ? "current streak" : "start your streak today"}
            </p>
          </div>
        </div>

        <div className="h-9 w-px bg-white/[0.08]" />

        {/* Productive days */}
        <div>
          <p className="text-lg font-bold leading-none text-white tabular-nums">
            {data.productiveDays}<span className="ml-0.5 text-sm font-medium text-white/40">/{data.totalDays}</span>
          </p>
          <p className="mt-1 text-xs text-white/40">productive days (90d)</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {data.todayMetGoal && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {data.goalHours}h goal hit today
          </span>
        )}
        <Link href="/activity" className="text-xs text-white/35 transition hover:text-white/65">
          View activity →
        </Link>
      </div>
    </motion.div>
  );
}
