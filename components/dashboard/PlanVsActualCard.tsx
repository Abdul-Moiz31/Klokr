"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useDailyPlannerState } from "@/lib/daily-planner/useDailyPlannerState";
import { computeOnTaskStats } from "@/lib/daily-planner/onTask";
import { dayKey } from "@/lib/daily-planner/storage";
import type { TabSession } from "@/lib/supabase";

type Props = {
  /** Today's tracked sessions (already fetched by the dashboard). */
  sessions: TabSession[];
  /** On-task % threshold from prefs — drives the on-task credit. Default 80. */
  autoCompleteThreshold?: number;
};

function fmtMinutes(min: number): string {
  const total = Math.round(min);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function PlanVsActualCard({ sessions, autoCompleteThreshold = 80 }: Props) {
  const { state, hydrated } = useDailyPlannerState();
  const today = useMemo(() => new Date(), []);

  const summary = useMemo(() => {
    if (!state) return null;
    const day = state.adHocByDate[dayKey(today)];
    if (!day) return null;

    const scheduled = day.tasks.filter(
      (t) => t.startMinutes != null && t.endMinutes != null
    );
    if (scheduled.length === 0) return null;

    const completed = scheduled.filter((t) => t.done).length;
    const plannedMinutes = scheduled.reduce(
      (sum, t) => sum + ((t.endMinutes as number) - (t.startMinutes as number)),
      0
    );

    let onTaskMinutes = 0;
    for (const t of scheduled) {
      onTaskMinutes += computeOnTaskStats(t, sessions, today, autoCompleteThreshold).onTaskMinutes;
    }

    const completionPct = scheduled.length > 0 ? Math.round((completed / scheduled.length) * 100) : 0;
    const adherencePct = plannedMinutes > 0 ? Math.round((onTaskMinutes / plannedMinutes) * 100) : 0;

    return {
      total: scheduled.length,
      completed,
      plannedMinutes,
      onTaskMinutes,
      completionPct,
      adherencePct,
    };
  }, [state, today, sessions, autoCompleteThreshold]);

  if (!hydrated) return null;

  // No plan today → gentle nudge to plan (reinforces the core loop).
  if (!summary) {
    return (
      <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">No plan for today yet</p>
          <p className="mt-0.5 text-sm text-white/45">
            Plan your day and Klokrs will measure how much of it you actually did — automatically.
          </p>
        </div>
        <Link
          href="/daily-planner"
          className="shrink-0 inline-flex items-center justify-center rounded-xl border border-violet-500/30 bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-600/35"
        >
          Plan today →
        </Link>
      </div>
    );
  }

  const onTrack = summary.adherencePct >= autoCompleteThreshold && summary.completionPct >= 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${onTrack ? "bg-emerald-500/15 text-emerald-300" : "bg-violet-500/15 text-violet-300"}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-white/85">Plan vs actual · today</h3>
        </div>
        <Link href="/daily-planner" className="text-xs text-white/35 transition hover:text-white/65">
          Open planner →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Tasks done" value={`${summary.completed}/${summary.total}`} accent={summary.completionPct >= 50 ? "emerald" : "violet"} />
        <Stat label="Completion" value={`${summary.completionPct}%`} accent={summary.completionPct >= 50 ? "emerald" : "violet"} />
        <Stat label="Planned time" value={fmtMinutes(summary.plannedMinutes)} accent="violet" />
        <Stat label="On-task time" value={fmtMinutes(summary.onTaskMinutes)} accent={onTrack ? "emerald" : "amber"} />
      </div>

      {/* Adherence bar */}
      <div className="mt-6">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-white/40">Plan adherence</span>
          <span className={`font-semibold tabular-nums ${onTrack ? "text-emerald-300" : "text-amber-300"}`}>
            {summary.adherencePct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full ${onTrack ? "bg-emerald-400/70" : "bg-amber-400/70"}`}
            style={{ width: `${Math.min(100, summary.adherencePct)}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          {onTrack ? (
            <>You&apos;re on track — <b className="text-white/70">{fmtMinutes(summary.onTaskMinutes)}</b> on your planned work so far. Keep it up.</>
          ) : (
            <>You planned <b className="text-white/70">{fmtMinutes(summary.plannedMinutes)}</b> and have <b className="text-white/70">{fmtMinutes(summary.onTaskMinutes)}</b> on-task so far. Tag domains on your tasks so Klokrs can credit your time.</>
          )}
        </p>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: "emerald" | "violet" | "amber" }) {
  const color = accent === "emerald" ? "text-emerald-300" : accent === "amber" ? "text-amber-300" : "text-violet-200";
  return (
    <div>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-white/40">{label}</p>
    </div>
  );
}
