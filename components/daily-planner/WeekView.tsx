"use client";

import { useEffect, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import type { DayData, PlannerTask, RoutineTemplateKind } from "@/lib/daily-planner/types";
import { dayKey } from "@/lib/daily-planner/storage";
import {
  SNAP_MINUTES,
  dateToMinutes,
  minutesToDate,
  normalizeRange,
  startOfLocalDay,
  formatMinutes,
} from "@/lib/daily-planner/timeline";
import { getTaskColor } from "@/lib/daily-planner/taskColor";

const SNAP_DURATION = `00:${String(SNAP_MINUTES).padStart(2, "0")}:00`;

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
  minViewableDay?: Date | null;
  onTaskTimeChange: (dayDate: Date, taskId: string, startMinutes: number, endMinutes: number) => void;
  onCreateRange: (dayDate: Date, startMinutes: number, endMinutes: number) => void;
  onEditTask: (dayDate: Date, taskId: string) => void;
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
  minViewableDay = null,
  onTaskTimeChange,
  onCreateRange,
  onEditTask,
}: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const hasScrolledRef = useRef(false);

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
    const map = new Map<string, { total: number; done: number; minutes: number; isTemplate: boolean }>();
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const key = dayKey(date);
      const day = adHocByDate[key];
      const realTasks = day?.tasks.filter((t) => t.startMinutes != null && t.endMinutes != null) ?? [];

      if (realTasks.length > 0) {
        map.set(key, {
          total: realTasks.length,
          done: realTasks.filter((t) => t.done).length,
          minutes: realTasks.reduce((s, t) => s + (t.endMinutes! - t.startMinutes!), 0),
          isTemplate: false,
        });
      } else {
        const kind = templateKindForDay(date);
        const tplTasks = routineTemplates[kind]?.tasks.filter(
          (t) => t.startMinutes != null && t.endMinutes != null
        ) ?? [];
        map.set(key, {
          total: tplTasks.length,
          done: 0,
          minutes: tplTasks.reduce((s, t) => s + (t.endMinutes! - t.startMinutes!), 0),
          isTemplate: tplTasks.length > 0,
        });
      }
    }
    return map;
  }, [weekStart, adHocByDate, routineTemplates]);

  // Week totals count only real (non-template) tasks
  const weekTotals = useMemo(() => {
    let total = 0, done = 0, minutes = 0;
    for (const s of dayStats.values()) {
      if (!s.isTemplate) { total += s.total; done += s.done; minutes += s.minutes; }
    }
    return { total, done, minutes };
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
        out.push({
          id: isTemplateDay ? `tpl-${key}::${t.id}` : `${key}::${t.id}`,
          title: t.title || "(untitled)",
          start: minutesToDate(date, t.startMinutes),
          end: minutesToDate(date, t.endMinutes),
          editable: !isTemplateDay && !t.done,
          classNames: [
            "klokrs-event",
            "klokrs-week-event",
            `klokrs-event--${color}`,
            t.done ? "klokrs-event--done" : "",
            isTemplateDay ? "klokrs-event--template" : "",
          ].filter(Boolean),
          extendedProps: { taskId: t.id, task: t, isTemplate: isTemplateDay },
        });
      }
    }
    return out;
  }, [weekStart, adHocByDate, routineTemplates]);

  const handleDrop = (info: EventDropArg) => {
    const ev = info.event;
    if (!ev.start || !ev.end || ev.extendedProps?.isTemplate) { info.revert(); return; }
    const taskId = (ev.extendedProps?.taskId as string) ?? ev.id.split("::")[1] ?? ev.id;
    const dayDate = startOfLocalDay(ev.start);
    const { start, end } = normalizeRange(dateToMinutes(ev.start), dateToMinutes(ev.end));
    onTaskTimeChange(dayDate, taskId, start, end);
  };

  const handleResize = (info: EventResizeDoneArg) => {
    const ev = info.event;
    if (!ev.start || !ev.end || ev.extendedProps?.isTemplate) { info.revert(); return; }
    const taskId = (ev.extendedProps?.taskId as string) ?? ev.id.split("::")[1] ?? ev.id;
    const dayDate = startOfLocalDay(ev.start);
    const { start, end } = normalizeRange(dateToMinutes(ev.start), dateToMinutes(ev.end));
    onTaskTimeChange(dayDate, taskId, start, end);
  };

  const handleSelect = (info: DateSelectArg) => {
    const dayDate = startOfLocalDay(info.start);
    if (minViewableDay && dayDate < startOfLocalDay(minViewableDay)) {
      calendarRef.current?.getApi().unselect();
      return;
    }
    const { start, end } = normalizeRange(dateToMinutes(info.start), dateToMinutes(info.end));
    onCreateRange(dayDate, start, end);
    calendarRef.current?.getApi().unselect();
  };

  const handleEventClick = (info: EventClickArg) => {
    if (info.event.extendedProps?.isTemplate) return;
    const taskId = info.event.extendedProps?.taskId as string | undefined;
    if (info.event.start && taskId) {
      onEditTask(startOfLocalDay(info.event.start), taskId);
    }
  };

  return (
    <div>
      {/* ── Week summary bar ── */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.02] py-3">
          <span className="text-2xl font-bold leading-none tabular-nums text-white/70">{weekTotals.total}</span>
          <span className="text-[10px] text-white/30">tasks this week</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.02] py-3">
          <span className={`text-2xl font-bold leading-none tabular-nums ${weekTotals.done > 0 ? "text-emerald-300" : "text-white/20"}`}>
            {weekTotals.done}
          </span>
          <span className="text-[10px] text-white/30">completed</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.02] py-3">
          <span className="text-2xl font-bold leading-none tabular-nums text-violet-300/70">
            {weekTotals.minutes > 0 ? fmtTime(weekTotals.minutes) : "—"}
          </span>
          <span className="text-[10px] text-white/30">planned time</span>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        {([
          ["prayer",   "rgba(52,211,153,0.75)",  "Prayer / Quran"],
          ["sleep",    "rgba(99,102,241,0.72)",   "Sleep / Rest"],
          ["work",     "rgba(192,132,252,0.78)",  "Work / Study"],
          ["exercise", "rgba(251,146,60,0.78)",   "Exercise"],
          ["food",     "rgba(251,191,36,0.68)",   "Food / Meals"],
          ["family",   "rgba(244,114,182,0.75)",  "Family / Social"],
          ["default",  "rgba(124,58,237,0.62)",   "Other"],
        ] as const).map(([, color, label]) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] text-white/35">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[10px] text-white/25">
          <span className="h-2.5 w-2.5 rounded-sm shrink-0 border border-dashed border-white/25" />
          Routine template (preview)
        </span>
      </div>

      {/* ── Calendar grid ── */}
      <div className="klokrs-timeline klokrs-week rounded-xl border border-white/[0.07] bg-white/[0.02] p-2 sm:p-3">
        <FullCalendar
          ref={calendarRef as unknown as React.Ref<FullCalendar>}
          plugins={[timeGridPlugin, interactionPlugin]}
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
          editable
          selectable
          selectMirror
          events={events}
          eventOverlap
          slotEventOverlap
          eventDrop={handleDrop}
          eventResize={handleResize}
          select={handleSelect}
          eventClick={handleEventClick}
          dayHeaderContent={(arg) => {
            const key = dayKey(startOfLocalDay(arg.date));
            const s = dayStats.get(key) ?? { total: 0, done: 0, minutes: 0, isTemplate: false };
            const weekday = arg.date
              .toLocaleDateString("en-US", { weekday: "short" })
              .toUpperCase();
            const dateNum = arg.date.getDate();
            const allDone = !s.isTemplate && s.total > 0 && s.done === s.total;
            return (
              <div className="flex flex-col items-center gap-0.5 py-1.5 px-0.5">
                <span
                  className={`text-[9px] font-bold tracking-widest ${
                    arg.isToday ? "text-violet-400" : "text-white/30"
                  }`}
                >
                  {weekday}
                </span>
                <span
                  className={`flex items-center justify-center text-[15px] font-bold leading-none tabular-nums ${
                    arg.isToday
                      ? "h-7 w-7 rounded-full bg-violet-500/25 text-white/95"
                      : "text-white/55"
                  }`}
                >
                  {dateNum}
                </span>
                {s.total > 0 ? (
                  s.isTemplate ? (
                    <span className="rounded-full border border-dashed border-white/15 px-1.5 py-[1px] text-[8px] text-white/25">
                      {s.total} planned
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-1.5 py-[1px] text-[8px] font-semibold tabular-nums ${
                        allDone
                          ? "bg-emerald-500/15 text-emerald-300/80"
                          : "bg-violet-500/10 text-violet-300/60"
                      }`}
                    >
                      {s.done}/{s.total}
                    </span>
                  )
                ) : (
                  <span className="text-[8px] text-white/15">empty</span>
                )}
              </div>
            );
          }}
          eventContent={(arg) => {
            const task = arg.event.extendedProps?.task as PlannerTask | undefined;
            const done = task?.done === true;
            const startM = arg.event.start
              ? arg.event.start.getHours() * 60 + arg.event.start.getMinutes()
              : 0;
            const endM = arg.event.end
              ? arg.event.end.getHours() * 60 + arg.event.end.getMinutes()
              : startM;
            const dur = endM - startM;
            return (
              <div className="klokrs-event-body klokrs-week-event-body">
                <div className="klokrs-event-row">
                  <div className={`klokrs-event-title ${done ? "klokrs-event-title--done" : ""}`}>
                    {arg.event.title}
                  </div>
                  <span className="klokrs-event-dur">{fmtTime(dur)}</span>
                </div>
                <div className="klokrs-event-meta">{formatMinutes(startM)}</div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
