"use client";

import { useEffect, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import type { PlannerTask } from "@/lib/daily-planner/types";
import type { TabSession } from "@/lib/supabase";
import { computeOnTaskStats, type OnTaskStats } from "@/lib/daily-planner/onTask";
import {
  SNAP_MINUTES,
  dateToMinutes,
  formatRange,
  minutesToDate,
  normalizeRange,
  startOfLocalDay,
} from "@/lib/daily-planner/timeline";

type Props = {
  forDate: Date;
  tasks: PlannerTask[];
  /** Called when user drags or resizes a block. Range is already snapped. */
  onTaskTimeChange: (taskId: string, startMinutes: number, endMinutes: number) => void;
  /** Called when user drags on empty area; modal opens pre-filled with the range. */
  onCreateRange: (startMinutes: number, endMinutes: number) => void;
  /** Called when user clicks a block; modal opens for edit. */
  onEditTask: (taskId: string) => void;
  /** Toggle the done state of a task from the calendar block's checkbox. */
  onToggleDone?: (taskId: string) => void;
  /** External draggable container (the unscheduled rail). */
  externalDropContainerRef?: React.RefObject<HTMLElement | null>;
  /** Called when an external item is dropped onto the timeline. */
  onExternalDrop?: (taskId: string, startMinutes: number, endMinutes: number) => void;
  /** Read-only mode for past days. */
  readOnly?: boolean;
  /** Today's (or `forDate`'s) tab sessions — used to render fill bars per task. */
  sessions?: TabSession[];
  /** Auto-completion threshold % — drives the fill-bar color and corner check. */
  autoCompleteThreshold?: number;
};

const SNAP_DURATION = `00:${String(SNAP_MINUTES).padStart(2, "0")}:00`;
const EMPTY_SESSIONS: TabSession[] = [];

export function TimelineView({
  forDate,
  tasks,
  onTaskTimeChange,
  onCreateRange,
  onEditTask,
  onToggleDone,
  externalDropContainerRef,
  onExternalDrop,
  readOnly = false,
  sessions = EMPTY_SESSIONS,
  autoCompleteThreshold = 80,
}: Props) {
  const statsByTaskId = useMemo(() => {
    const map = new Map<string, OnTaskStats>();
    for (const t of tasks) {
      if (t.startMinutes == null || t.endMinutes == null) continue;
      map.set(t.id, computeOnTaskStats(t, sessions, forDate, autoCompleteThreshold));
    }
    return map;
  }, [tasks, sessions, forDate, autoCompleteThreshold]);

  const calendarRef = useRef<FullCalendar | null>(null);
  const dragRef = useRef<Draggable | null>(null);

  // Reattach external draggable when the source container changes.
  useEffect(() => {
    if (readOnly) return;
    const el = externalDropContainerRef?.current;
    if (!el) return;
    dragRef.current = new Draggable(el, {
      itemSelector: "[data-unscheduled-task]",
      eventData: (taskEl) => {
        const id = taskEl.getAttribute("data-task-id") ?? "";
        const title = taskEl.getAttribute("data-task-title") ?? "(untitled)";
        // Unscheduled tasks have no inherent duration — default to 60 min on drop.
        const duration = 60;
        return {
          id,
          title,
          duration: `00:${String(Math.floor(duration / 60)).padStart(2, "0")}:${String(
            duration % 60
          ).padStart(2, "0")}:00`,
          // FullCalendar uses this object as the event's extendedProps
          extendedProps: { taskId: id, external: true },
        };
      },
    });
    return () => {
      dragRef.current?.destroy();
      dragRef.current = null;
    };
  }, [externalDropContainerRef, readOnly]);

  // Imperatively retarget the calendar's date if forDate changes (FullCalendar
  // ignores subsequent changes to initialDate).
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.gotoDate(startOfLocalDay(forDate));
  }, [forDate]);

  const events: EventInput[] = useMemo(() => {
    return tasks
      .filter((t) => t.startMinutes != null && t.endMinutes != null)
      .map((t) => {
        const start = minutesToDate(forDate, t.startMinutes!);
        const end = minutesToDate(forDate, t.endMinutes!);
        return {
          id: t.id,
          title: t.title || "(untitled)",
          start,
          end,
          editable: !readOnly && !t.done,
          classNames: [
            "klokrs-event",
            t.done ? "klokrs-event--done" : "",
          ].filter(Boolean),
          extendedProps: { task: t },
        } satisfies EventInput;
      });
  }, [tasks, forDate, readOnly]);

  const handleDrop = (info: EventDropArg) => {
    const ev = info.event;
    if (!ev.start || !ev.end) {
      info.revert();
      return;
    }
    const { start, end } = normalizeRange(dateToMinutes(ev.start), dateToMinutes(ev.end));
    onTaskTimeChange(ev.id, start, end);
  };

  const handleResize = (info: EventResizeDoneArg) => {
    const ev = info.event;
    if (!ev.start || !ev.end) {
      info.revert();
      return;
    }
    const { start, end } = normalizeRange(dateToMinutes(ev.start), dateToMinutes(ev.end));
    onTaskTimeChange(ev.id, start, end);
  };

  const handleSelect = (info: DateSelectArg) => {
    const { start, end } = normalizeRange(dateToMinutes(info.start), dateToMinutes(info.end));
    onCreateRange(start, end);
    calendarRef.current?.getApi().unselect();
  };

  const handleEventClick = (info: EventClickArg) => {
    if (readOnly) return;
    onEditTask(info.event.id);
  };

  return (
    <div className="klokrs-timeline rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2 sm:p-4">
      <FullCalendar
        ref={calendarRef as unknown as React.Ref<FullCalendar>}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridDay"
        initialDate={startOfLocalDay(forDate)}
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
        editable={!readOnly}
        selectable={!readOnly}
        selectMirror
        droppable={!readOnly && Boolean(onExternalDrop)}
        events={events}
        eventOverlap
        slotEventOverlap
        eventDrop={handleDrop}
        eventResize={handleResize}
        select={handleSelect}
        eventClick={handleEventClick}
        eventContent={(arg) => {
          const task = arg.event.extendedProps?.task as PlannerTask | undefined;
          const start = arg.event.start ? dateToMinutes(arg.event.start) : 0;
          const end = arg.event.end ? dateToMinutes(arg.event.end) : start;
          const done = task?.done === true;
          const canToggle = !readOnly && task != null && onToggleDone != null;
          const stats = task ? statsByTaskId.get(task.id) : undefined;
          // Fill bar width: cap visual at 100% even if percent exceeds it.
          const fillWidth = stats ? Math.min(100, Math.max(0, stats.percent)) : 0;
          const fillClass = stats
            ? stats.status === "no-activity"
              ? ""
              : stats.status === "below"
              ? "klokrs-event-fill--below"
              : "klokrs-event-fill--above"
            : "";
          const showCheck = stats != null && stats.percent >= 100;
          // The checkbox swallows mouse/pointer events so it doesn't trigger
          // FullCalendar's eventClick (which opens the edit modal) or start a
          // drag on the block. `mouseDownCapture` is the early hook FullCalendar
          // uses to begin drag tracking.
          return (
            <div className="klokrs-event-body">
              <div className="klokrs-event-row">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={done ? "Mark not done" : "Mark done"}
                  disabled={!canToggle}
                  onMouseDownCapture={(e) => {
                    if (!canToggle) return;
                    e.stopPropagation();
                  }}
                  onPointerDownCapture={(e) => {
                    if (!canToggle) return;
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    if (!canToggle) return;
                    e.stopPropagation();
                    onToggleDone(task!.id);
                  }}
                  className={`klokrs-event-checkbox ${done ? "klokrs-event-checkbox--done" : ""} ${
                    canToggle ? "" : "klokrs-event-checkbox--readonly"
                  }`}
                >
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 8 8" fill="none" aria-hidden>
                      <path
                        d="M1.5 4L3 5.5L6.5 2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                <div className={`klokrs-event-title ${done ? "klokrs-event-title--done" : ""}`}>
                  {arg.event.title}
                </div>
                {showCheck && (
                  <span
                    className="klokrs-event-corner-check"
                    aria-label="Task completed on time"
                    title={`${Math.round(stats!.percent)}% on tagged domains`}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path
                        d="M2.5 6.5L5 9L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              </div>
              <div className="klokrs-event-meta">{formatRange(start, end)}</div>
              {stats && stats.totalWindowMinutes > 0 && (
                <div className="klokrs-event-fill-track" aria-hidden>
                  <div
                    className={`klokrs-event-fill ${fillClass}`}
                    style={{ width: `${fillWidth}%` }}
                  />
                </div>
              )}
            </div>
          );
        }}
        eventReceive={(info) => {
          // External drag from unscheduled rail. FullCalendar created a temp
          // event — we don't want it in our event list, so remove it and
          // notify the parent which already owns the task.
          if (!onExternalDrop) {
            info.event.remove();
            return;
          }
          const taskId = (info.event.extendedProps?.taskId as string) ?? info.event.id;
          if (!info.event.start || !info.event.end) {
            info.event.remove();
            return;
          }
          const { start, end } = normalizeRange(
            dateToMinutes(info.event.start),
            dateToMinutes(info.event.end)
          );
          info.event.remove();
          onExternalDrop(taskId, start, end);
        }}
      />
    </div>
  );
}
