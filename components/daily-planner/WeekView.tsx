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
import type { DayData, PlannerTask } from "@/lib/daily-planner/types";
import { dayKey } from "@/lib/daily-planner/storage";
import {
  SNAP_MINUTES,
  dateToMinutes,
  minutesToDate,
  normalizeRange,
  startOfLocalDay,
  formatMinutes,
} from "@/lib/daily-planner/timeline";

const SNAP_DURATION = `00:${String(SNAP_MINUTES).padStart(2, "0")}:00`;

type Props = {
  /** Any date inside the week to display. The view snaps to that week. */
  anchorDate: Date;
  /** Map of dayKey → that day's DayData (read straight from planner state). */
  adHocByDate: Record<string, DayData | undefined>;
  /** Earliest day the user can navigate to (account creation). */
  minViewableDay?: Date | null;
  /** Move/resize an existing task on a specific day. Range is already snapped. */
  onTaskTimeChange: (dayDate: Date, taskId: string, startMinutes: number, endMinutes: number) => void;
  /** Drag on empty space → create a task on that day, pre-filled with the range. */
  onCreateRange: (dayDate: Date, startMinutes: number, endMinutes: number) => void;
  /** Click a task → open the edit modal for it on its day. */
  onEditTask: (dayDate: Date, taskId: string) => void;
};

/** Local start-of-week (Sunday) for the given date. */
function startOfWeek(d: Date): Date {
  const base = startOfLocalDay(d);
  base.setDate(base.getDate() - base.getDay()); // 0 = Sunday
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
  minViewableDay = null,
  onTaskTimeChange,
  onCreateRange,
  onEditTask,
}: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);

  // Keep the calendar pinned to the anchor week if the anchor changes.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (api) api.gotoDate(weekStart);
  }, [weekStart]);

  // Build editable events for every scheduled task across all 7 days.
  const events: EventInput[] = useMemo(() => {
    const out: EventInput[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const key = dayKey(date);
      const day = adHocByDate[key];
      if (!day) continue;
      for (const t of day.tasks) {
        if (t.startMinutes == null || t.endMinutes == null) continue;
        out.push({
          id: `${key}::${t.id}`,
          title: t.title || "(untitled)",
          start: minutesToDate(date, t.startMinutes),
          end: minutesToDate(date, t.endMinutes),
          // Done tasks aren't draggable (consistent with Day view).
          editable: !t.done,
          classNames: [
            "klokrs-event",
            "klokrs-week-event",
            t.done ? "klokrs-event--done" : "",
          ].filter(Boolean),
          extendedProps: { taskId: t.id, task: t },
        });
      }
    }
    return out;
  }, [weekStart, adHocByDate]);

  const handleDrop = (info: EventDropArg) => {
    const ev = info.event;
    if (!ev.start || !ev.end) { info.revert(); return; }
    const taskId = (ev.extendedProps?.taskId as string) ?? ev.id.split("::")[1] ?? ev.id;
    // ev.start reflects the (possibly new) day after a cross-column drag.
    const dayDate = startOfLocalDay(ev.start);
    const { start, end } = normalizeRange(dateToMinutes(ev.start), dateToMinutes(ev.end));
    onTaskTimeChange(dayDate, taskId, start, end);
  };

  const handleResize = (info: EventResizeDoneArg) => {
    const ev = info.event;
    if (!ev.start || !ev.end) { info.revert(); return; }
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
    const taskId = info.event.extendedProps?.taskId as string | undefined;
    if (info.event.start && taskId) {
      onEditTask(startOfLocalDay(info.event.start), taskId);
    }
  };

  return (
    <div className="klokrs-timeline klokrs-week rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2 sm:p-4">
      <FullCalendar
        ref={calendarRef as unknown as React.Ref<FullCalendar>}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        initialDate={weekStart}
        headerToolbar={false}
        allDaySlot={false}
        nowIndicator
        height="auto"
        contentHeight={960}
        expandRows
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        slotDuration={SNAP_DURATION}
        slotLabelInterval="01:00"
        snapDuration={SNAP_DURATION}
        dayHeaderFormat={{ weekday: "short", day: "numeric" }}
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
        eventContent={(arg) => {
          const task = arg.event.extendedProps?.task as PlannerTask | undefined;
          const done = task?.done === true;
          const startM = arg.event.start
            ? arg.event.start.getHours() * 60 + arg.event.start.getMinutes()
            : 0;
          return (
            <div className="klokrs-event-body klokrs-week-event-body">
              <div className="klokrs-event-row">
                <div className={`klokrs-event-title ${done ? "klokrs-event-title--done" : ""}`}>
                  {arg.event.title}
                </div>
              </div>
              <div className="klokrs-event-meta">{formatMinutes(startM)}</div>
            </div>
          );
        }}
      />
    </div>
  );
}
