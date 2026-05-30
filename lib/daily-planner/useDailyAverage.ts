"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Average tracked minutes per active day over the trailing `lookbackDays`
 * window, computed from real tab_sessions. "Active day" = a day with any
 * tracked time, so days off don't drag the average toward zero.
 *
 * Used by the capacity / overcommit warning — this is data only Klokrs has,
 * since we passively track actual time rather than relying on self-report.
 */
export function useDailyAverage(
  userId: string | null,
  lookbackDays = 21
): { avgMinutes: number | null; activeDays: number; loading: boolean } {
  const [avgMinutes, setAvgMinutes] = useState<number | null>(null);
  const [activeDays, setActiveDays] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const today = new Date();
      const from = new Date(today);
      from.setDate(today.getDate() - lookbackDays);
      // Exclude today — a half-finished day would understate the average.
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const supabase = createClient();
      const { data } = await supabase
        .from("tab_sessions")
        .select("date, duration_seconds")
        .eq("user_id", userId)
        .gte("date", localDateStr(from))
        .lte("date", localDateStr(yesterday));

      if (cancelled) return;
      if (!data || data.length === 0) {
        setAvgMinutes(null);
        setActiveDays(0);
        setLoading(false);
        return;
      }

      const byDay = new Map<string, number>();
      for (const r of data) {
        byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.duration_seconds);
      }
      const totalSeconds = Array.from(byDay.values()).reduce((s, v) => s + v, 0);
      const days = byDay.size;
      setActiveDays(days);
      setAvgMinutes(days > 0 ? totalSeconds / days / 60 : null);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId, lookbackDays]);

  return { avgMinutes, activeDays, loading };
}
