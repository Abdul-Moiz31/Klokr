"use client";

import { useEffect, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import type { DayData, PlannerTask } from "@/lib/daily-planner/types";
import { dayKey } from "@/lib/daily-planner/storage";
import { minutesToDate, startOfLocalDay, formatMinutes } from "@/lib/daily-planner/timeline";

const SNAP_DURATION = "00:15:00";

type Props = {
  /** Any date inside the week to display. The view snaps to that week. */
  anchorDate: Date;
  /** Map of dayKey → that day's DayData (read straight from planner state). */
  adHocByDate: Record<string, DayData | undefined>;
  /** Jump to a specific day in the Today editor. */
  onOpenDay: (date: Date) => void;
  /** Earliest day the user can navigate to (account creation). */
  minViewableDay?: Date | null;
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

export function WeekView({ anchorDate, adHocByDate, onOpenDay, minViewableDay = null }: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);

  // Keep the calendar pinned to the anchor week if the anchor changes.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (api) api.gotoDate(weekStart);
  }, [weekStart]);

  // Build read-only events for every scheduled task across all 7 days.
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
          id: `${key}-${t.id}`,
          title: t.title || "(untitled)",
          start: minutesToDate(date, t.startMinutes),
          end: minutesToDate(date, t.endMinutes),
          editable: false,
          classNames: [
            "klokrs-event",
            "klokrs-week-event",
            t.done ? "klokrs-event--done" : "",
          ].filter(Boolean),
          extendedProps: { dayDate: date, task: t },
        });
      }
    }
    return out;
  }, [weekStart, adHocByDate]);

  const handleEventClick = (info: EventClickArg) => {
    const date = info.event.extendedProps?.dayDate as Date | undefined;
    if (date) onOpenDay(date);
  };

  const handleDateClick = (info: DateClickArg) => {
    // Clicking an empty slot jumps to that day's editor to schedule there.
    if (minViewableDay && startOfLocalDay(info.date) < startOfLocalDay(minViewableDay)) return;
    onOpenDay(info.date);
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
        dayHeaderFormat={{ weekday: "short", day: "numeric" }}
        editable={false}
        selectable={false}
        events={events}
        eventOverlap
        slotEventOverlap
        eventClick={handleEventClick}
        dateClick={handleDateClick}
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
