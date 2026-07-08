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
import type { IdleRange, PlannerTask } from "@/lib/daily-planner/types";
import { getTaskColor } from "@/lib/daily-planner/taskColor";
import { CategoryIcon } from "@/lib/daily-planner/taskIcon";
import type { TabSession } from "@/lib/supabase";
import {
  computeOnTaskStats,
  type OnTaskStats,
  type UnscheduledGap,
} from "@/lib/daily-planner/onTask";
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
  /** Unscheduled gaps with tracked activity — rendered as red coral blocks. */
  unscheduledGaps?: UnscheduledGap[];
  /** User-marked idle ranges — rendered as muted gray blocks. */
  idleRanges?: IdleRange[];
  /** Click handler for red unscheduled-gap blocks. */
  onGapClick?: (gap: UnscheduledGap) => void;
  /**
   * Local time in minutes since midnight — used to decide whether a task's
   * window is in the past for the offline-prompt and other end-of-window UI.
   * Pass null to disable any "past-window" treatment (e.g. on past days).
   */
  nowMinutes?: number | null;
  /** Phase 5 — confirm an offline-only completion of a zero-activity task. */
  onMarkOfflineComplete?: (taskId: string) => void;
  /** Phase 5 — mark a zero-activity task as skipped. */
  onMarkSkipped?: (taskId: string) => void;
};

const SNAP_DURATION = `00:${String(SNAP_MINUTES).padStart(2, "0")}:00`;
const EMPTY_SESSIONS: TabSession[] = [];
const EMPTY_GAPS: UnscheduledGap[] = [];
const EMPTY_IDLE: IdleRange[] = [];

/** Stable id for a gap so FullCalendar can diff it across renders. */
function gapEventId(gap: UnscheduledGap): string {
  return `gap-${gap.fromMinutes}-${gap.toMinutes}`;
}
function idleEventId(r: IdleRange): string {
  return `idle-${r.fromMinutes}-${r.toMinutes}`;
}
function fmtMinutes(min: number): string {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

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
  unscheduledGaps = EMPTY_GAPS,
  idleRanges = EMPTY_IDLE,
  onGapClick,
  nowMinutes = null,
  onMarkOfflineComplete,
  onMarkSkipped,
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
  const hasScrolledRef = useRef(false);

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
    hasScrolledRef.current = false; // reset scroll-to-now on date change
  }, [forDate]);

  // Scroll to 1h before the current time once per mount (or date change).
  useEffect(() => {
    if (hasScrolledRef.current) return;
    if (nowMinutes == null) return;
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const target = Math.max(0, nowMinutes - 60);
    const h = String(Math.floor(target / 60)).padStart(2, "0");
    const m = String(target % 60).padStart(2, "0");
    api.scrollToTime(`${h}:${m}:00`);
    hasScrolledRef.current = true;
  }, [nowMinutes]);

  const events: EventInput[] = useMemo(() => {
    const taskEvents: EventInput[] = tasks
      .filter((t) => t.startMinutes != null && t.endMinutes != null)
      .map((t) => {
        const start = minutesToDate(forDate, t.startMinutes!);
        const end = minutesToDate(forDate, t.endMinutes!);
        const isActive = !t.done && nowMinutes != null &&
          t.startMinutes! <= nowMinutes && t.endMinutes! > nowMinutes;
        // Prefer the persisted outcome (set once, at window end, by
        // pickAutoCompletions) — falls back to the old live time-based guess
        // only for tasks that haven't been classified yet (e.g. auto-complete
        // is disabled in Settings, or the window only just ended).
        const isPartial = !t.done && t.outcome === "partial";
        const isMissed = !t.done && !t.skipped && (
          t.outcome === "missed" ||
          (t.outcome == null && nowMinutes != null && (t.endMinutes as number) <= nowMinutes)
        );
        return {
          id: t.id,
          title: t.title || "(untitled)",
          start,
          end,
          editable: !readOnly && !t.done,
          classNames: [
            "klokrs-event",
            `klokrs-event--${getTaskColor(t.title || "")}`,
            t.done ? "klokrs-event--done" : "",
            isActive ? "klokrs-event--active" : "",
            isPartial ? "klokrs-event--partial" : "",
            isMissed ? "klokrs-event--missed" : "",
          ].filter(Boolean),
          extendedProps: { kind: "task", task: t },
        } satisfies EventInput;
      });

    const gapEvents: EventInput[] = unscheduledGaps.map((gap) => ({
      id: gapEventId(gap),
      title: "Background activity",
      start: minutesToDate(forDate, gap.fromMinutes),
      end: minutesToDate(forDate, gap.toMinutes),
      editable: false,
      classNames: ["klokrs-event", "klokrs-event--gap"],
      extendedProps: { kind: "gap", gap },
    }));

    const idleEvents: EventInput[] = idleRanges.map((r) => ({
      id: idleEventId(r),
      title: "Idle",
      start: minutesToDate(forDate, r.fromMinutes),
      end: minutesToDate(forDate, r.toMinutes),
      editable: false,
      classNames: ["klokrs-event", "klokrs-event--idle"],
      extendedProps: { kind: "idle", idle: r },
    }));

    return [...taskEvents, ...gapEvents, ...idleEvents];
  }, [tasks, forDate, readOnly, unscheduledGaps, idleRanges, nowMinutes]);

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
    const kind = info.event.extendedProps?.kind as string | undefined;
    if (kind === "gap") {
      const gap = info.event.extendedProps?.gap as UnscheduledGap | undefined;
      if (gap && onGapClick) onGapClick(gap);
      return;
    }
    if (kind === "idle") return;
    if (readOnly) return;
    onEditTask(info.event.id);
  };

  return (
    <div className="klokrs-timeline rounded-xl border border-white/[0.07] bg-white/[0.02] p-2 sm:p-4">
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
          const kind = (arg.event.extendedProps?.kind as string | undefined) ?? "task";
          const start = arg.event.start ? dateToMinutes(arg.event.start) : 0;
          const end = arg.event.end ? dateToMinutes(arg.event.end) : start;
          const dur = end - start;
          if (kind === "gap") {
            const gap = arg.event.extendedProps?.gap as UnscheduledGap | undefined;
            const activity = gap?.activityMinutes ?? end - start;
            return (
              <div className="klokrs-event-body klokrs-event-body--gap">
                <div className="klokrs-event-row">
                  <div className="klokrs-event-title">Background activity</div>
                </div>
                <div className="klokrs-event-meta">
                  {formatRange(start, end)} · {fmtMinutes(activity)}
                </div>
              </div>
            );
          }
          if (kind === "idle") {
            return (
              <div className="klokrs-event-body klokrs-event-body--idle">
                <div className="klokrs-event-row">
                  <div className="klokrs-event-title">Idle</div>
                </div>
                <div className="klokrs-event-meta">{formatRange(start, end)}</div>
              </div>
            );
          }
          const task = arg.event.extendedProps?.task as PlannerTask | undefined;
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
          // Offline prompt: window in the past, zero tracked activity, no manual
          // attributions, and not already done/skipped. Only on today (caller
          // controls this via the nowMinutes prop).
          const windowEndedInPast =
            task != null &&
            task.endMinutes != null &&
            nowMinutes != null &&
            (task.endMinutes as number) <= nowMinutes;
          const noActivityInWindow =
            stats != null &&
            stats.onTaskMinutes === 0 &&
            (!task?.manualAttributions || task.manualAttributions.length === 0);
          const showOfflinePrompt =
            !readOnly &&
            task != null &&
            !task.done &&
            !task.skipped &&
            task.outcome == null &&
            windowEndedInPast &&
            noActivityInWindow &&
            onMarkOfflineComplete != null &&
            onMarkSkipped != null;
          const isActive = !done && nowMinutes != null &&
            task != null && task.startMinutes != null && task.endMinutes != null &&
            task.startMinutes <= nowMinutes && task.endMinutes > nowMinutes;
          const category = getTaskColor(task?.title ?? "");
          // Persisted outcome (set once, at window end) — falls back to the
          // live time-based guess only for tasks not yet classified (e.g.
          // auto-complete disabled, or window just ended this tick).
          const isPartial = !done && task?.outcome === "partial";
          const isMissedFinal = !done && task != null && !task.skipped && (
            task.outcome === "missed" ||
            (task.outcome == null && windowEndedInPast)
          );
          return (
            <div className="klokrs-event-body">
              <div className="klokrs-event-row">
                {/* Icon badge doubles as the done-toggle — Structured-style
                    "island with an icon" that flips to a checkmark when done. */}
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
                  title={isPartial ? "Partial — tap to mark done" : isMissedFinal ? "Missed — tap to mark done" : undefined}
                  className={`klokrs-event-icon-badge klokrs-event-icon-badge--${category} ${done ? "klokrs-event-icon-badge--done" : ""} ${
                    isPartial ? "klokrs-event-icon-badge--partial" : ""
                  } ${isMissedFinal ? "klokrs-event-icon-badge--missed" : ""} ${
                    canToggle ? "" : "klokrs-event-icon-badge--readonly"
                  }`}
                >
                  {done ? (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : isPartial ? (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M6 1.5A4.5 4.5 0 0 1 10.5 6H6V1.5Z" fill="currentColor" />
                    </svg>
                  ) : isMissedFinal ? (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <CategoryIcon category={category} size={11} />
                  )}
                </button>
                <div className={`klokrs-event-title ${done ? "klokrs-event-title--done" : ""}`}>
                  {arg.event.title}
                </div>
                {isActive ? (
                  <span className="klokrs-event-live" aria-hidden />
                ) : (
                  <span className="klokrs-event-dur">{fmtMinutes(dur)}</span>
                )}
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
              <div className="klokrs-event-meta">
                {formatRange(start, end)}
                {showOfflinePrompt && task && (
                  <span className="klokrs-event-offline-group">
                    <button
                      type="button"
                      title="Mark done"
                      aria-label="Mark done"
                      className="klokrs-event-offline-icon klokrs-event-offline-icon--yes"
                      onMouseDownCapture={(e) => e.stopPropagation()}
                      onPointerDownCapture={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onMarkOfflineComplete!(task.id); }}
                    >
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button
                      type="button"
                      title="Skip"
                      aria-label="Skip"
                      className="klokrs-event-offline-icon"
                      onMouseDownCapture={(e) => e.stopPropagation()}
                      onPointerDownCapture={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onMarkSkipped!(task.id); }}
                    >
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    </button>
                  </span>
                )}
              </div>
              {stats && stats.totalWindowMinutes > 0 && (task?.domainTags?.length ?? 0) > 0 && (
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
