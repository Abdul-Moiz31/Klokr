"use client";

import type { DailyPlannerV5, DayData, PlannerTask } from "@/lib/daily-planner/types";
import type { TabSession } from "@/lib/supabase";
import { dayKey } from "@/lib/daily-planner/date";
import { TimelineView } from "./TimelineView";

function ReadOnlyTask({ task }: { task: PlannerTask }) {
  const { title, description, done, domainTags } = task;
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
        {description && (
          <p className="mt-0.5 text-xs text-white/45 leading-snug whitespace-pre-wrap">
            {description}
          </p>
        )}
        {domainTags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
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
  state: DailyPlannerV5;
  forDate: Date;
  sessions?: TabSession[];
  autoCompleteThreshold?: number;
};

export function PastDayView({ state, forDate, sessions, autoCompleteThreshold }: Props) {
  const k = dayKey(forDate);
  const adHoc: DayData = state.adHocByDate[k] ?? { groups: [], tasks: [] };
  const scheduled = adHoc.tasks.filter(
    (t) => t.startMinutes != null && t.endMinutes != null
  );
  const unscheduled = adHoc.tasks.filter((t) => t.startMinutes == null);

  if (adHoc.tasks.length === 0) {
    const label = forDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-4 py-14 text-center">
        <svg
          aria-hidden
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto mb-3 text-white/20"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <p className="text-sm text-white/45">
          You didn&apos;t record anything on {label}.
        </p>
        <p className="mt-1 text-xs text-white/25">
          Journal only shows days where you planned or completed tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {scheduled.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
            Timeline
          </h3>
          <TimelineView
            forDate={forDate}
            tasks={scheduled}
            onTaskTimeChange={() => {}}
            onCreateRange={() => {}}
            onEditTask={() => {}}
            readOnly
            sessions={sessions}
            autoCompleteThreshold={autoCompleteThreshold}
          />
        </div>
      )}

      {unscheduled.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
            Unscheduled
          </h3>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="space-y-1 px-3 py-2">
              {unscheduled.map((t) => (
                <ReadOnlyTask key={t.id} task={t} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
