"use client";

import { useEffect, useState } from "react";
import type { TabSession } from "@/lib/supabase";
import { useDailyPlannerState } from "./useDailyPlannerState";
import { pickAutoCompletions, localMinutesNow } from "./autoComplete";
import { dayKey } from "./date";

/**
 * Classifies a day's domain-tracked scheduled tasks (done/partial/missed) as
 * their windows end — shared so it runs no matter which page is open
 * (dashboard, daily planner, ...). Previously this only lived inside the
 * Daily Planner page component, so a task never got marked done/partial/missed
 * unless that exact page happened to be open right as its window ended.
 *
 * Also doubles as lazy history backfill: pass a past `forDate` (e.g. the
 * Daily Planner's viewDate when browsing a previous day) and any task on
 * that day that never got classified — because the app simply wasn't open
 * when its window ended — gets resolved the first time that day is viewed,
 * using that day's real sessions. A past day has no "live" ticking (nothing
 * about it changes), so the 60s re-check only runs when `forDate` is today.
 */
export function useAutoCompleteTasks(
  sessions: TabSession[],
  prefs: { autoCompleteEnabled: boolean; autoCompleteThreshold: number },
  forDate: Date = new Date()
): void {
  const { state, patchState } = useDailyPlannerState();
  const [tick, setTick] = useState(0);
  const dateK = dayKey(forDate);
  const isToday = dateK === dayKey(new Date());

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  useEffect(() => {
    if (!state || !prefs.autoCompleteEnabled) return;
    const day = state.adHocByDate[dateK];
    if (!day || day.tasks.length === 0) return;

    // A past day is entirely "in the past" — every scheduled window on it has
    // ended, so evaluate as if now were end-of-day. Only today needs the
    // actual current-clock-time cutoff.
    const nowMin = isToday ? localMinutesNow(forDate) : 1440;
    const picks = pickAutoCompletions(day.tasks, sessions, forDate, prefs, nowMin);
    if (picks.length === 0) return;

    patchState((s) => {
      const d = s.adHocByDate[dateK];
      if (!d) return s;
      for (const t of d.tasks) {
        const p = picks.find((x) => x.taskId === t.id);
        if (!p) continue;
        t.done = p.done;
        t.outcome = p.outcome;
        if (p.done) {
          t.autoCompleted = true;
          t.completedAt = p.completedAt;
        }
      }
      return s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, sessions, prefs.autoCompleteEnabled, prefs.autoCompleteThreshold, dateK, isToday, tick]);
}
