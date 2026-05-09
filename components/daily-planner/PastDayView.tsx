"use client";

import type { DailyPlannerV2, DayData, PlannerTask } from "@/lib/daily-planner/types";
import { dayKey } from "@/lib/daily-planner/date";

function ReadOnlyTask({ task }: { task: PlannerTask }) {
  const { title, done, urgent, estimateMinutes, domainTags } = task;
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 ${done ? "opacity-50" : ""}`}>
      <div
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          done ? "border-violet-500/50 bg-violet-500/20" : "border-white/20"
        }`}
      >
        {done && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3 5.5L6.5 2" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${done ? "line-through text-white/40" : "text-white/85"}`}>
          {title || "—"}
        </p>
        {(urgent || estimateMinutes != null || domainTags.length > 0) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {urgent && (
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300/90">
                Urgent
              </span>
            )}
            {estimateMinutes != null && (
              <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40 tabular-nums">
                {estimateMinutes}m
              </span>
            )}
            {domainTags.map((d) => (
              <span key={d} className="rounded-md border border-cyan-500/15 bg-cyan-950/30 px-1.5 py-0.5 text-[10px] text-cyan-400/70">
                {d}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type Props = {
  state: DailyPlannerV2;
  forDate: Date;
};

export function PastDayView({ state, forDate }: Props) {
  const k = dayKey(forDate);
  const adHoc: DayData = state.adHocByDate[k] ?? { groups: [], tasks: [] };
  const sortedGroups = [...adHoc.groups].sort((a, b) => a.order - b.order);
  const groupsWithTasks = sortedGroups.filter((g) =>
    adHoc.tasks.some((t) => t.groupId === g.id)
  );

  const hasAnything = adHoc.tasks.length > 0;

  if (!hasAnything) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-14 text-center">
        <p className="text-sm text-white/30">Nothing was planned for this day.</p>
        <p className="mt-1 text-xs text-white/20">
          Journal shows the task blocks saved for that date.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groupsWithTasks.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
            Plan
          </h3>
          <div className="space-y-3">
            {groupsWithTasks.map((g) => {
              const tasks = adHoc.tasks
                .filter((t) => t.groupId === g.id)
                .sort((a, b) => a.order - b.order);
              return (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <p className="text-sm font-semibold text-white/90">{g.title}</p>
                    <span className="text-[10px] text-white/30 tabular-nums">
                      {tasks.filter((t) => t.done).length}/{tasks.length}
                    </span>
                  </div>
                  <div className="space-y-1 px-3 py-2">
                    {tasks.map((t) => (
                      <ReadOnlyTask key={t.id} task={t} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
