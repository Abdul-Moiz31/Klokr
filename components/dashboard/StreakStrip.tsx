"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { loadPrefs } from "@/lib/prefs";
import { calcForgivingStreak, countProductiveDays, localDateStr } from "@/lib/streak";

type Props = {
  userId: string | null;
};

type StreakData = {
  streak: number;
  graceUsed: boolean;
  atRisk: boolean;
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
      const fs = calcForgivingStreak(map, todayStr);
      setData({
        streak: fs.count,
        graceUsed: fs.graceUsed,
        atRisk: fs.atRisk,
        productiveDays: countProductiveDays(map, thresholdS),
        totalDays: map.size,
        goalHours: prefs.productiveHoursThreshold,
        todayMetGoal: (map.get(todayStr) ?? 0) >= thresholdS,
      });
    })();

    return () => { cancelled = true; };
  }, [userId, prefs]);

  if (!data) return null;

  const productivePct = data.totalDays > 0 ? Math.round((data.productiveDays / data.totalDays) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-white/85">Activity</h3>
        </div>
        <Link href="/activity" className="text-xs text-white/35 transition hover:text-white/65">
          View activity →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Productive days */}
        <div>
          <p className="text-xl font-bold leading-none text-white tabular-nums">
            {data.productiveDays}<span className="ml-1 text-sm font-medium text-white/40">/{data.totalDays}</span>
          </p>
          <p className="mt-1 text-xs text-white/40">productive days (90d)</p>
        </div>

        {/* Productive % */}
        <div>
          <p className="text-xl font-bold leading-none text-emerald-300 tabular-nums">{productivePct}%</p>
          <p className="mt-1 text-xs text-white/40">of days productive</p>
        </div>
      </div>

      {data.todayMetGoal && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {data.goalHours}h goal hit today
        </span>
      )}
    </motion.div>
  );
}
