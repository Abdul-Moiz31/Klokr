"use client";

import { motion } from "framer-motion";
import type { DailyPlannerV2, RecurringRule } from "@/lib/daily-planner/types";
import { isRecurringDone, rulesForDate } from "@/lib/daily-planner/storage";

const FREQ_LABEL: Record<RecurringRule["frequency"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};

type Props = {
  state: DailyPlannerV2;
  forDate: Date;
  onToggleDone: (ruleId: string) => void;
};

export function TodayRecurringTable({ state, forDate, onToggleDone }: Props) {
  const list = rulesForDate(state.recurringRules, forDate);

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center">
        <p className="text-sm text-white/30">No recurring tasks for today.</p>
        <p className="mt-0.5 text-xs text-white/20">Add routines under the &quot;Recurring&quot; tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((r, i) => {
        const done = isRecurringDone(state, r.id, forDate);
        return (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className={`group flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors duration-150 ${
              done
                ? "border-white/[0.05] bg-white/[0.02] opacity-55"
                : "border-violet-500/15 bg-violet-950/20 hover:bg-violet-950/30"
            }`}
          >
            {/* Checkbox */}
            <button
              type="button"
              aria-label={done ? "Mark pending" : "Mark done"}
              onClick={() => onToggleDone(r.id)}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                done
                  ? "border-violet-500/50 bg-violet-500/20"
                  : "border-white/25 hover:border-violet-400/60"
              }`}
            >
              {done && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4 7L8 3" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Title + freq */}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium leading-snug ${done ? "text-white/40 line-through" : "text-white/90"}`}>
                {r.title || "(no title)"}
              </p>
              <p className="mt-0.5 text-xs text-white/35">{FREQ_LABEL[r.frequency]}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {r.urgent && (
                <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300/90">
                  Urgent
                </span>
              )}
              {r.estimateMinutes != null && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/45 tabular-nums">
                  {r.estimateMinutes}m
                </span>
              )}
              {r.domainTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.domainTags.slice(0, 2).map((d) => (
                    <span
                      key={d}
                      className="rounded-md border border-cyan-500/15 bg-cyan-950/30 px-1.5 py-0.5 text-[10px] text-cyan-400/70"
                    >
                      {d}
                    </span>
                  ))}
                  {r.domainTags.length > 2 && (
                    <span className="text-[10px] text-white/25">+{r.domainTags.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
