"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventInput } from "@fullcalendar/core";
import type { DayData, PlannerTask, RoutineTemplateKind } from "@/lib/daily-planner/types";
import { dayKey } from "@/lib/daily-planner/storage";
import {
  SNAP_MINUTES,
  minutesToDate,
  startOfLocalDay,
  formatMinutes,
} from "@/lib/daily-planner/timeline";
import { getTaskColor } from "@/lib/daily-planner/taskColor";
import { CategoryIcon } from "@/lib/daily-planner/taskIcon";

const SNAP_DURATION = `00:${String(SNAP_MINUTES).padStart(2, "0")}:00`;

const CATEGORY_COLORS: Record<string, string> = {
  prayer: "rgba(52,211,153,0.85)",
  sleep: "rgba(99,102,241,0.82)",
  work: "rgba(192,132,252,0.85)",
  exercise: "rgba(251,146,60,0.85)",
  food: "rgba(251,191,36,0.8)",
  family: "rgba(244,114,182,0.85)",
  default: "rgba(167,139,250,0.75)",
};
const CATEGORY_LABELS: Record<string, string> = {
  prayer: "Prayer / Quran",
  sleep: "Sleep / Rest",
  work: "Work / Study",
  exercise: "Exercise",
  food: "Food / Meals",
  family: "Family / Social",
  default: "Other",
};

function fmtTime(min: number): string {
  const total = Math.round(min);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function templateKindForDay(date: Date): RoutineTemplateKind {
  const dow = date.getDay();
  if (dow === 0) return "sunday";
  if (dow === 6) return "saturday";
  return "weekdays";
}

type Props = {
  anchorDate: Date;
  adHocByDate: Record<string, DayData | undefined>;
  routineTemplates: Record<RoutineTemplateKind, DayData>;
};

function startOfWeek(d: Date): Date {
  const base = startOfLocalDay(d);
  base.setDate(base.getDate() - base.getDay());
  return base;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function WeekView({
  anchorDate,
  adHocByDate,
  routineTemplates,
}: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const hasScrolledRef = useRef(false);
  const [showLegend, setShowLegend] = useState(false);

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);

  useEffect(() => {
    const t = setTimeout(() => {
      const api = calendarRef.current?.getApi();
      if (api) {
        api.gotoDate(weekStart);
        hasScrolledRef.current = false;
      }
    }, 0);
    return () => clearTimeout(t);
  }, [weekStart]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (hasScrolledRef.current) return;
      const api = calendarRef.current?.getApi();
      if (!api) return;
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const target = Math.max(0, nowMin - 60);
      const h = String(Math.floor(target / 60)).padStart(2, "0");
      const m = String(target % 60).padStart(2, "0");
      api.scrollToTime(`${h}:${m}:00`);
      hasScrolledRef.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Per-day stats: real tasks take priority, fall back to template for empty days
  const dayStats = useMemo(() => {
    const map = new Map<
      string,
      { total: number; done: number; partial: number; missed: number; minutes: number; isTemplate: boolean; categories: string[] }
    >();
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const key = dayKey(date);
      const day = adHocByDate[key];
      const realTasks = day?.tasks.filter((t) => t.startMinutes != null && t.endMinutes != null) ?? [];

      if (realTasks.length > 0) {
        map.set(key, {
          total: realTasks.length,
          done: realTasks.filter((t) => t.done).length,
          partial: realTasks.filter((t) => !t.done && t.outcome === "partial").length,
          missed: realTasks.filter((t) => !t.done && t.outcome === "missed").length,
          minutes: realTasks.reduce((s, t) => s + (t.endMinutes! - t.startMinutes!), 0),
          isTemplate: false,
          categories: [...new Set(realTasks.map((t) => getTaskColor(t.title || "")))].slice(0, 5),
        });
      } else {
        const kind = templateKindForDay(date);
        const tplTasks = routineTemplates[kind]?.tasks.filter(
          (t) => t.startMinutes != null && t.endMinutes != null
        ) ?? [];
        map.set(key, {
          total: tplTasks.length,
          done: 0,
          partial: 0,
          missed: 0,
          minutes: tplTasks.reduce((s, t) => s + (t.endMinutes! - t.startMinutes!), 0),
          isTemplate: tplTasks.length > 0,
          categories: [...new Set(tplTasks.map((t) => getTaskColor(t.title || "")))].slice(0, 5),
        });
      }
    }
    return map;
  }, [weekStart, adHocByDate, routineTemplates]);

  // Week totals count only real (non-template) tasks
  const weekTotals = useMemo(() => {
    let total = 0, done = 0, partial = 0, missed = 0, minutes = 0;
    for (const s of dayStats.values()) {
      if (!s.isTemplate) { total += s.total; done += s.done; partial += s.partial; missed += s.missed; minutes += s.minutes; }
    }
    return { total, done, partial, missed, minutes };
  }, [dayStats]);

  const events: EventInput[] = useMemo(() => {
    const out: EventInput[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const key = dayKey(date);
      const day = adHocByDate[key];
      const realTasks = day?.tasks.filter((t) => t.startMinutes != null && t.endMinutes != null) ?? [];
      const isTemplateDay = realTasks.length === 0;

      const tasks = isTemplateDay
        ? (routineTemplates[templateKindForDay(date)]?.tasks ?? [])
        : realTasks;

      for (const t of tasks) {
        if (t.startMinutes == null || t.endMinutes == null) continue;
        const color = getTaskColor(t.title || "");
        // A template preview is just a pattern, not a resolved instance of
        // any real day — it must never show done/partial/missed, regardless
        // of whatever completion state happens to sit on the template's own
        // task object (e.g. left over from before an instance was cloned out
        // of it). Persisted outcome only applies to real, non-template tasks.
        const done = !isTemplateDay && t.done === true;
        const isPartial = !isTemplateDay && !t.done && t.outcome === "partial";
        const isMissed = !isTemplateDay && !t.done && !t.skipped && t.outcome === "missed";
        out.push({
          id: isTemplateDay ? `tpl-${key}::${t.id}` : `${key}::${t.id}`,
          title: t.title || "(untitled)",
          start: minutesToDate(date, t.startMinutes),
          end: minutesToDate(date, t.endMinutes),
          editable: false,
          classNames: [
            "klokrs-event",
            "klokrs-week-event",
            `klokrs-event--${color}`,
            done ? "klokrs-event--done" : "",
            isPartial ? "klokrs-event--partial" : "",
            isMissed ? "klokrs-event--missed" : "",
            isTemplateDay ? "klokrs-event--template" : "",
          ].filter(Boolean),
          extendedProps: { taskId: t.id, task: t, isTemplate: isTemplateDay },
        });
      }
    }
    return out;
  }, [weekStart, adHocByDate, routineTemplates]);

  return (
    <div>
      {/* ── Week summary bar ── */}
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/30">This week</p>
          <p className="text-xl font-bold leading-none tabular-nums text-white/85">{weekTotals.total} tasks</p>
        </div>
        <div className="hidden h-8 w-px bg-white/[0.08] sm:block" />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/30">Completed</p>
          <p className={`text-xl font-bold leading-none tabular-nums ${weekTotals.done > 0 ? "text-emerald-300" : "text-white/25"}`}>
            {weekTotals.done}
          </p>
        </div>
        {weekTotals.partial > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/30">Partial</p>
            <p className="text-xl font-bold leading-none tabular-nums text-amber-300">
              {weekTotals.partial}
            </p>
          </div>
        )}
        {weekTotals.missed > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/30">Missed</p>
            <p className="text-xl font-bold leading-none tabular-nums text-red-300/80">
              {weekTotals.missed}
            </p>
          </div>
        )}
        <div className="hidden h-8 w-px bg-white/[0.08] sm:block" />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/30">Planned time</p>
          <p className="text-xl font-bold leading-none tabular-nums text-violet-300/80">
            {weekTotals.minutes > 0 ? fmtTime(weekTotals.minutes) : "—"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowLegend((v) => !v)}
          className="ml-auto flex items-center gap-1 text-[11px] font-medium text-white/30 transition hover:text-white/60"
        >
          Legend
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showLegend ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>

      {/* ── Legend (collapsed by default) ── */}
      {showLegend && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] text-white/35">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[key] }} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[10px] text-white/25">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0 border border-dashed border-white/25" />
            Routine template (preview)
          </span>
        </div>
      )}

      {/* ── Calendar grid ── */}
      <div className="klokrs-timeline klokrs-week rounded-xl border border-white/[0.07] bg-white/[0.02] p-2 sm:p-3">
        <FullCalendar
          ref={calendarRef as unknown as React.Ref<FullCalendar>}
          plugins={[timeGridPlugin]}
          initialView="timeGridWeek"
          initialDate={weekStart}
          headerToolbar={false}
          allDaySlot={false}
          nowIndicator
          height="auto"
          contentHeight={900}
          expandRows
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration={SNAP_DURATION}
          slotLabelInterval="01:00"
          snapDuration={SNAP_DURATION}
          editable={false}
          selectable={false}
          events={events}
          eventOverlap
          slotEventOverlap
          dayHeaderContent={(arg) => {
            const key = dayKey(startOfLocalDay(arg.date));
            const s = dayStats.get(key) ?? { total: 0, done: 0, minutes: 0, isTemplate: false, categories: [] };
            const weekday = arg.date
              .toLocaleDateString("en-US", { weekday: "short" })
              .toUpperCase();
            const dateNum = arg.date.getDate();
            const allDone = !s.isTemplate && s.total > 0 && s.done === s.total;
            return (
              <div className="flex flex-col items-center gap-1.5 py-2 px-0.5">
                <span
                  className={`text-[9px] font-bold tracking-widest ${
                    arg.isToday ? "text-violet-300" : "text-white/30"
                  }`}
                >
                  {weekday}
                </span>
                <span
                  className={`flex items-center justify-center text-[14px] font-bold leading-none tabular-nums ${
                    arg.isToday
                      ? "h-7 w-7 rounded-full bg-violet-500 text-white shadow-[0_0_0_3px_rgba(124,58,237,0.18)]"
                      : allDone
                        ? "text-emerald-300/90"
                        : "text-white/70"
                  }`}
                >
                  {dateNum}
                </span>
                {/* Overlapping dot cluster — one dot per task category present
                    that day, standing in for the old numeric "x/y" badge. */}
                <div className="flex h-2.5 items-center" aria-label={s.total > 0 ? `${s.total} tasks` : "No tasks"}>
                  {s.categories.length > 0 ? (
                    s.categories.map((cat, i) => (
                      <span
                        key={cat}
                        className="h-2.5 w-2.5 rounded-full border-2 border-[#0A0A0F]"
                        style={{
                          background: CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default,
                          opacity: s.isTemplate ? 0.4 : 1,
                          marginLeft: i === 0 ? 0 : -5,
                        }}
                      />
                    ))
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-white/10" />
                  )}
                </div>
              </div>
            );
          }}
          eventContent={(arg) => {
            const task = arg.event.extendedProps?.task as PlannerTask | undefined;
            const isTemplate = arg.event.extendedProps?.isTemplate === true;
            // A template preview is a pattern, not a resolved day — never
            // shown as done/partial/missed, whatever the template task holds.
            const done = !isTemplate && task?.done === true;
            const isPartial = !isTemplate && !done && task?.outcome === "partial";
            const isMissed = !isTemplate && !done && !task?.skipped && task?.outcome === "missed";
            const startM = arg.event.start
              ? arg.event.start.getHours() * 60 + arg.event.start.getMinutes()
              : 0;
            const endM = arg.event.end
              ? arg.event.end.getHours() * 60 + arg.event.end.getMinutes()
              : startM;
            const dur = endM - startM;
            const category = getTaskColor(task?.title ?? "");
            const outcomeLabel = done ? " · Done" : isPartial ? " · Partial" : isMissed ? " · Missed" : "";
            const fullLabel = `${arg.event.title} · ${formatMinutes(startM)} (${fmtTime(dur)})${outcomeLabel}`;
            // Structured-style compressed week view: short blocks show just the
            // category icon (time is already encoded by vertical position);
            // blocks with enough room also get a single-line label. Once a
            // task is classified, the icon swaps to reflect done/partial/missed
            // instead of the category, same as the single-day timeline.
            return (
              <div className="klokrs-event-body klokrs-week-event-body" title={fullLabel}>
                <div
                  className={`klokrs-week-event-icon ${done ? "klokrs-week-event-icon--done" : ""} ${
                    isPartial ? "klokrs-week-event-icon--partial" : ""
                  } ${isMissed ? "klokrs-week-event-icon--missed" : ""}`}
                >
                  {done ? (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : isPartial ? (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M6 1.5A4.5 4.5 0 0 1 10.5 6H6V1.5Z" fill="currentColor" />
                    </svg>
                  ) : isMissed ? (
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <CategoryIcon category={category} size={11} />
                  )}
                </div>
                {dur >= 40 && (
                  <div className={`klokrs-event-title ${done ? "klokrs-event-title--done" : ""}`}>
                    {arg.event.title}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
