"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useDailyPlannerState } from "@/lib/daily-planner/useDailyPlannerState";
import { computeOnTaskStats } from "@/lib/daily-planner/onTask";
import { localMinutesNow } from "@/lib/daily-planner/autoComplete";
import { dayKey } from "@/lib/daily-planner/storage";
import type { PlannerTask } from "@/lib/daily-planner/types";
import type { TabSession } from "@/lib/supabase";

type ActiveTask = { task: PlannerTask; stats: ReturnType<typeof computeOnTaskStats> };

type Props = {
  active: ActiveTask;
};

function fmtClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function fmtMinutes(min: number): string {
  const total = Math.round(min);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Live-updating "now" so the card notices window boundaries and elapsed time
 * even when `sessions` hasn't changed. */
function useNow(tickMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

export function useActiveScheduledTask(
  sessions: TabSession[],
  autoCompleteThreshold = 80,
  tickMs = 20_000
): ActiveTask | null {
  const { state } = useDailyPlannerState();
  const now = useNow(tickMs);

  return useMemo(() => {
    if (!state) return null;
    const day = state.adHocByDate[dayKey(now)];
    if (!day) return null;

    const nowMinutes = localMinutesNow(now);
    const active = day.tasks.find(
      (t) =>
        t.startMinutes != null &&
        t.endMinutes != null &&
        t.startMinutes <= nowMinutes &&
        nowMinutes < t.endMinutes &&
        !t.skipped
    );
    if (!active) return null;

    const stats = computeOnTaskStats(active, sessions, now, autoCompleteThreshold);
    return { task: active, stats };
  }, [state, now, sessions, autoCompleteThreshold]);
}

export function CurrentTaskCard({ active }: Props) {
  const { task, stats } = active;
  const percent = Math.min(100, Math.round(stats.percent));
  // This card only renders while the window is still active (see
  // useActiveScheduledTask) — percent can still drop back down before the
  // window closes (the denominator keeps growing), so "on track" is as far
  // as we can honestly claim here. The real done/partial/missed call only
  // happens once, at window end (see useAutoCompleteTasks).
  const onTrack = stats.status === "above" || stats.status === "at-threshold";
  const remainingMinutes = Math.max(0, (task.endMinutes as number) - localMinutesNow(new Date()));

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/35">
              In progress · {fmtClock(task.startMinutes as number)} – {fmtClock(task.endMinutes as number)}
            </p>
          </div>
          <Link href="/daily-planner" className="text-xs text-white/35 transition hover:text-white/65">
            Open planner →
          </Link>
        </div>

        <h3 className="mb-1 text-lg font-semibold text-white/90">{task.title}</h3>
        <p className="mb-4 text-xs text-white/40">
          {task.domainTags.length > 0
            ? `Tracking ${task.domainTags.join(", ")}`
            : "No domains tagged for this task yet"}
        </p>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-white/40">
              {fmtMinutes(stats.onTaskMinutes)} on-task · {fmtMinutes(remainingMinutes)} left
            </span>
            <span className={`font-semibold tabular-nums ${onTrack ? "text-emerald-300" : "text-violet-200"}`}>
              {percent}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className={`h-full rounded-full ${onTrack ? "bg-emerald-400/70" : "bg-violet-400/70"}`}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
