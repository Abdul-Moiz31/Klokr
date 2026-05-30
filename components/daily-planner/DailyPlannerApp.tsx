"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Loader } from "@/components/ui/Loader";
import { RecurringRoutinesPanel } from "./RecurringRoutinesPanel";
import { PastDayView } from "./PastDayView";
import { RoutineTemplatesEditor } from "./RoutineTemplatesEditor";
import { TimelineView } from "./TimelineView";
import { CapacityWarning } from "./CapacityWarning";
import { UnscheduledRail } from "./UnscheduledRail";
import { TimelineTaskModal, type TimelineTaskDraft } from "./TimelineTaskModal";
import { ExtensionPlannerSync } from "@/components/ExtensionPlannerSync";
import { useDailyPlannerState } from "@/lib/daily-planner/useDailyPlannerState";
import { useTodaySessions } from "@/lib/daily-planner/useTodaySessions";
import {
  findUnscheduledGaps,
  mergeIdleRanges,
  type UnscheduledGap,
} from "@/lib/daily-planner/onTask";
import { localMinutesNow, pickAutoCompletions } from "@/lib/daily-planner/autoComplete";
import { createEmptyDayData, dayKey } from "@/lib/daily-planner/storage";
import { suggestedRoutineTemplateKind } from "@/lib/daily-planner/date";
import { normalizeRange } from "@/lib/daily-planner/timeline";
import { DEFAULT_PREFS, loadPrefs, type KlokrsPrefs } from "@/lib/prefs";
import { BackgroundActivityModal } from "./BackgroundActivityModal";
import type {
  DayData,
  PlannerTask,
  RecurringRule,
  RoutineTemplateKind,
} from "@/lib/daily-planner/types";

const TABS = [
  {
    id: "today",
    label: "Today",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    tooltip: "Your plan for the day: load a template or edit tasks directly. Use the date arrows to browse past days in journal mode.",
  },
  {
    id: "routines",
    label: "Recurring",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
    ),
    tooltip: "Library of routines (frequency + domains). Use Add to copy a row into a weekday/weekend template or straight onto today’s plan.",
  },
  {
    id: "templates",
    label: "Templates",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="10" width="7" height="11" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    tooltip: "Save reusable day starters for weekdays, Saturday, Sunday, and a fallback. Load them onto any day in one click.",
  },
  // { id: "inbox", label: "Inbox" }, // coming soon
] as const;

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseCreatedAtToLocalDay(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return startOfLocalDay(d);
}

function formatJoinedDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatNavDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function SectionHeader({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">{label}</h3>
      <InfoTooltip text={tooltip} />
    </div>
  );
}

type DailyPlannerAppProps = {
  /** ISO timestamp of when the user signed up; bounds how far back they can journal. */
  accountCreatedAt?: string | null;
  /** Current user id — used by the capacity warning to read tracked history. */
  userId?: string | null;
};

export function DailyPlannerApp({ accountCreatedAt = null, userId = null }: DailyPlannerAppProps = {}) {
  const {
    state,
    hydrated,
    getTodayKey,
    patchTodayAdHoc,
    setTaskDump,
    clearAdHocForToday,
    addRecurringRule,
    replaceRecurringRule,
    removeRecurringRule,
    appendRecurringRuleToTemplate,
    appendRecurringRuleToToday,
    forceAppendRecurringRuleToToday,
    getTrackingRules,
    applyRoutineTemplateToToday,
    setRoutineTemplate,
    setTemplateTaskDomains,
    newId: newIdFn,
  } = useDailyPlannerState();

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("today");
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [prefs, setPrefs] = useState<KlokrsPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    setPrefs(loadPrefs());
    // Re-read on focus/visibility so Settings changes (made in another tab or
    // earlier in the session) take effect without a full reload.
    const reload = () => setPrefs(loadPrefs());
    const onVis = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", reload);
    };
  }, []);
  // Fetch sessions for whatever day is being viewed (today → realtime + 30s poll;
  // past days → one-shot fetch). Used to render fill bars on each task block.
  const { sessions } = useTodaySessions(viewDate);
  const [confirmTemplate, setConfirmTemplate] = useState<RoutineTemplateKind | null>(null);
  const [confirmDuplicateRule, setConfirmDuplicateRule] = useState<RecurringRule | null>(null);
  const [modal, setModal] = useState<
    | { mode: "create"; initialRange?: { start: number; end: number } }
    | { mode: "edit"; taskId: string }
    | null
  >(null);
  const [gapModal, setGapModal] = useState<UnscheduledGap | null>(null);
  // Task IDs the user manually un-completed this session — auto-complete skips
  // them so they don't immediately flip back to done. Cleared on page reload.
  const ignoredAutoCompleteRef = useRef<Set<string>>(new Set());
  // Tick state to drive the 60s re-evaluation of end-of-window tasks. Bumping
  // this number re-runs the auto-completion effect even when state/sessions
  // didn't change (e.g. a task window just ended).
  const [autoCompleteTick, setAutoCompleteTick] = useState(0);
  const unscheduledRailRef = useRef<HTMLDivElement | null>(null);

  const todayK = getTodayKey();
  const viewK = dayKey(viewDate);
  const isViewingToday = viewK === todayK;
  const now = new Date();

  const minViewableDay = useMemo(
    () => parseCreatedAtToLocalDay(accountCreatedAt),
    [accountCreatedAt]
  );
  const minViewableK = minViewableDay ? dayKey(minViewableDay) : null;
  const atEarliestDay = minViewableK != null && viewK <= minViewableK;

  const todayAdHoc: DayData = useMemo(() => {
    if (!state) return createEmptyDayData();
    return state.adHocByDate[todayK] ?? createEmptyDayData();
  }, [state, todayK]);

  const scheduledTasks = useMemo(
    () => todayAdHoc.tasks.filter((t) => t.startMinutes != null && t.endMinutes != null),
    [todayAdHoc]
  );
  const plannedMinutesToday = useMemo(
    () =>
      scheduledTasks.reduce(
        (sum, t) => sum + ((t.endMinutes as number) - (t.startMinutes as number)),
        0
      ),
    [scheduledTasks]
  );
  const unscheduledTasks = useMemo(
    () => todayAdHoc.tasks.filter((t) => t.startMinutes == null),
    [todayAdHoc]
  );
  const todayIdleRanges = todayAdHoc.idleRanges ?? [];

  // 60s ticker so end-of-window auto-completion fires for tasks whose window
  // ends while the planner is open. Cheap — just a state bump.
  useEffect(() => {
    if (!isViewingToday) return;
    const id = setInterval(() => setAutoCompleteTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [isViewingToday]);

  // Auto-completion check. Runs whenever scheduledTasks / sessions / prefs /
  // tick change. Only writes when viewing today — past days shouldn't flip
  // retroactively, and future days obviously have no past windows.
  useEffect(() => {
    if (!isViewingToday) return;
    if (!prefs.autoCompleteEnabled) return;
    if (scheduledTasks.length === 0) return;
    const nowMin = localMinutesNow();
    const picks = pickAutoCompletions(
      scheduledTasks,
      sessions,
      viewDate,
      prefs,
      nowMin,
      ignoredAutoCompleteRef.current
    );
    if (picks.length === 0) return;
    const pickIds = new Set(picks.map((p) => p.taskId));
    setTodayTasks((tasks) =>
      tasks.map((t) => {
        const p = picks.find((x) => x.taskId === t.id);
        if (!p) return t;
        return {
          ...t,
          done: true,
          autoCompleted: true,
          completedAt: p.completedAt,
        };
      })
    );
    // Use the local var so the closure doesn't reference the ref directly.
    void pickIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isViewingToday,
    scheduledTasks,
    sessions,
    prefs.autoCompleteEnabled,
    prefs.autoCompleteThreshold,
    viewDate,
    autoCompleteTick,
  ]);

  // Pass idleRanges directly to findUnscheduledGaps so they're treated as
  // occupied alongside scheduled tasks. This prevents the "Idle block stacks
  // every minute" bug — once a gap is dismissed, new activity that extends
  // past the original gap end just produces a separate (smaller) gap, instead
  // of a new full-size red block that the user would dismiss again.
  const unscheduledGaps = useMemo(
    () =>
      findUnscheduledGaps(
        scheduledTasks,
        sessions,
        viewDate,
        prefs.redBlockMinGapMinutes,
        todayIdleRanges
      ),
    [scheduledTasks, sessions, viewDate, prefs.redBlockMinGapMinutes, todayIdleRanges]
  );

  const rules = getTrackingRules();
  const suggestedKind = suggestedRoutineTemplateKind(now);

  const ensureFirstGroupId = (data: DayData): { data: DayData; groupId: string } => {
    if (data.groups.length > 0) {
      const sorted = [...data.groups].sort((a, b) => a.order - b.order);
      return { data, groupId: sorted[0]!.id };
    }
    const fresh = createEmptyDayData();
    return { data: fresh, groupId: fresh.groups[0]!.id };
  };

  // Always go through patchTodayAdHoc so concurrent writes (e.g. the 60s
  // auto-complete tick + a user click) merge against the latest committed
  // state, not the captured render snapshot.
  const setTodayTasks = (mutate: (tasks: PlannerTask[]) => PlannerTask[]) => {
    patchTodayAdHoc((cur) => ({ ...cur, tasks: mutate(cur.tasks) }));
  };

  const upsertTaskTime = (taskId: string, startMinutes: number, endMinutes: number) => {
    const range = normalizeRange(startMinutes, endMinutes);
    setTodayTasks((tasks) =>
      tasks.map((t) =>
        t.id === taskId ? { ...t, startMinutes: range.start, endMinutes: range.end } : t
      )
    );
  };

  const createTaskFromModal = (draft: TimelineTaskDraft) => {
    patchTodayAdHoc((cur) => {
      const { data, groupId } = ensureFirstGroupId(cur);
      const maxOrder = data.tasks
        .filter((t) => t.groupId === groupId)
        .reduce((m, t) => Math.max(m, t.order), -1);
      const newTask: PlannerTask = {
        id: newIdFn(),
        groupId,
        title: draft.title,
        description: draft.description,
        done: draft.done,
        domainTags: draft.domainTags,
        order: maxOrder + 1,
        startMinutes: draft.startMinutes,
        endMinutes: draft.endMinutes,
      };
      return { ...data, tasks: [...data.tasks, newTask] };
    });
  };

  const updateTaskFromModal = (taskId: string, draft: TimelineTaskDraft) => {
    let propagateTo: { kind: RoutineTemplateKind; templateTaskId: string } | null = null;
    setTodayTasks((tasks) =>
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        if (
          draft.applyDomainsToTemplate &&
          t.sourceTemplateTaskId &&
          t.sourceTemplateKind
        ) {
          propagateTo = { kind: t.sourceTemplateKind, templateTaskId: t.sourceTemplateTaskId };
        }
        return {
          ...t,
          title: draft.title,
          description: draft.description,
          done: draft.done,
          domainTags: draft.domainTags,
          startMinutes: draft.startMinutes,
          endMinutes: draft.endMinutes,
        };
      })
    );
    if (propagateTo) {
      setTemplateTaskDomains(
        (propagateTo as { kind: RoutineTemplateKind; templateTaskId: string }).kind,
        (propagateTo as { kind: RoutineTemplateKind; templateTaskId: string }).templateTaskId,
        draft.domainTags
      );
    }
  };

  const deleteTask = (taskId: string) => {
    setTodayTasks((tasks) => tasks.filter((t) => t.id !== taskId));
  };

  const toggleTaskDone = (taskId: string) => {
    setTodayTasks((tasks) =>
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        const nextDone = !t.done;
        // Un-completing an auto-completed task: clear the auto flag and add
        // the task to the ignore set so the next 60s tick doesn't re-flip it.
        if (!nextDone && t.autoCompleted) {
          ignoredAutoCompleteRef.current.add(t.id);
          return { ...t, done: false, autoCompleted: false, completedAt: undefined };
        }
        // Manually completing: stamp completedAt for parity with auto path.
        if (nextDone) {
          return { ...t, done: true, completedAt: Date.now() };
        }
        return { ...t, done: false, completedAt: undefined };
      })
    );
  };

  // Phase 5 — offline-detection prompt handlers. "Mark complete" stamps a
  // manual completion (no autoCompleted flag — this was offline work, not
  // tracked). "Skipped" sets the skipped flag so auto-completion ignores it
  // forever and reports can distinguish skipped vs completed.
  const markOfflineComplete = (taskId: string) => {
    setTodayTasks((tasks) =>
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, done: true, completedAt: Date.now() }
          : t
      )
    );
    toast.success("Marked complete");
  };
  const markSkipped = (taskId: string) => {
    setTodayTasks((tasks) =>
      tasks.map((t) =>
        t.id === taskId ? { ...t, skipped: true } : t
      )
    );
    toast.success("Marked skipped");
  };

  // Phase 3 — Background-activity modal handlers.
  // "Assign to task" pushes a ManualAttribution onto the chosen task. The task
  // window stays put; the on-task % calc reads manualAttributions and credits
  // the gap's domain minutes (not the wall-clock gap length, so noise doesn't
  // inflate the bar).
  const assignGapToTask = (gap: UnscheduledGap, taskId: string) => {
    const now = Date.now();
    setTodayTasks((tasks) =>
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        const prev = t.manualAttributions ?? [];
        return {
          ...t,
          manualAttributions: [
            ...prev,
            {
              fromMinutes: gap.fromMinutes,
              toMinutes: gap.toMinutes,
              addedMinutes: Math.round(gap.activityMinutes),
              addedAt: now,
            },
          ],
        };
      })
    );
    setGapModal(null);
    toast.success("Background activity assigned");
  };

  // "Skip → mark as idle" — merges the new range with any existing idle
  // ranges so repeatedly dismissing the same area doesn't stack entries.
  // Uses the functional updater (patchTodayAdHoc) so a 60s auto-complete tick
  // firing in between can't clobber the write with a stale snapshot.
  const markGapIdle = (gap: UnscheduledGap) => {
    const now = Date.now();
    patchTodayAdHoc((cur) => ({
      ...cur,
      idleRanges: mergeIdleRanges(cur.idleRanges ?? [], {
        fromMinutes: gap.fromMinutes,
        toMinutes: gap.toMinutes,
        markedAt: now,
      }),
    }));
    setGapModal(null);
    toast.success("Marked as idle");
  };

  // "Copy as task" opens the create-task modal pre-filled with the gap's
  // range, falling back to a sensible default title if no top domain is
  // available.
  const copyGapAsTask = (gap: UnscheduledGap) => {
    setGapModal(null);
    setModal({
      mode: "create",
      initialRange: { start: gap.fromMinutes, end: gap.toMinutes },
    });
  };

  const quickCreateUnscheduled = (title: string) => {
    patchTodayAdHoc((cur) => {
      const { data, groupId } = ensureFirstGroupId(cur);
      const maxOrder = data.tasks
        .filter((t) => t.groupId === groupId)
        .reduce((m, t) => Math.max(m, t.order), -1);
      const newTask: PlannerTask = {
        id: newIdFn(),
        groupId,
        title,
        description: "",
        done: false,
        domainTags: [],
        order: maxOrder + 1,
        startMinutes: null,
        endMinutes: null,
      };
      return { ...data, tasks: [...data.tasks, newTask] };
    });
  };

  const taskBeingEdited = modal?.mode === "edit"
    ? todayAdHoc.tasks.find((t) => t.id === modal.taskId) ?? null
    : null;

  const tryApplyTemplate = (kind: RoutineTemplateKind) => {
    if (!state) return;
    if (state.adHocByDate[todayK] != null) {
      setConfirmTemplate(kind);
      return;
    }
    applyRoutineTemplateToToday(kind);
    toast.success(`${kind.charAt(0).toUpperCase() + kind.slice(1)} template loaded`);
  };

  if (!hydrated || !state) {
    return <Loader />;
  }

  return (
    <div className="w-full max-w-7xl">
      <ExtensionPlannerSync rules={rules} />

      {/* Tab bar */}
      <div className="mb-7 flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                if (t.id === "today") setViewDate(new Date());
              }}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-violet-600/25 text-violet-200 shadow-sm"
                  : "text-white/40 hover:text-white/65 hover:bg-white/[0.04]"
              }`}
            >
              <span className={isActive ? "text-violet-300/80" : "text-white/30"}>
                {t.icon}
              </span>
              {t.label}
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-0 rounded-xl border border-violet-500/20"
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "today" && (
            <div>
              {/* Date navigator */}
              <div className="mb-6 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewDate((d) => addDays(d, -1))}
                  disabled={atEarliestDay}
                  title={
                    atEarliestDay && minViewableDay
                      ? `You joined Klokrs on ${formatJoinedDate(minViewableDay)} — no days before that.`
                      : undefined
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-white/20 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-white/40"
                  aria-label="Previous day"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>

                <div className="flex flex-1 items-center justify-center gap-2">
                  <span className={`text-sm font-medium ${isViewingToday ? "text-white/80" : "text-white/60"}`}>
                    {isViewingToday ? `Today, ${formatNavDate(viewDate)}` : formatNavDate(viewDate)}
                  </span>
                  {!isViewingToday && (
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300/70">
                      Journal
                    </span>
                  )}
                  {atEarliestDay && minViewableDay && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                      Joined {formatJoinedDate(minViewableDay)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {!isViewingToday && (
                    <button
                      type="button"
                      onClick={() => setViewDate(new Date())}
                      className="rounded-lg border border-violet-500/25 bg-violet-600/15 px-2.5 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/25"
                    >
                      Today
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewDate((d) => addDays(d, 1))}
                    disabled={isViewingToday}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-white/20 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Next day"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Past day: read-only journal view */}
              {!isViewingToday ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={viewK}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    <PastDayView
                      state={state}
                      forDate={viewDate}
                      sessions={sessions}
                      autoCompleteThreshold={prefs.autoCompleteThreshold}
                    />
                  </motion.div>
                </AnimatePresence>
              ) : (
                /* Today: editable view */
                <>
                  <SectionHeader
                    label="Today's plan"
                    tooltip="Load a template for weekdays or weekend, edit blocks like Daily Routine, or add tasks manually. Routines from the Recurring tab land here when you use Add → Today's plan or add them into a template first."
                  />

                    {/* Template loader */}
                    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                      <span className="mr-1 text-[11px] text-white/30">Load template:</span>
                      <button
                        type="button"
                        onClick={() => tryApplyTemplate(suggestedKind)}
                        className="flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-600/15 px-2.5 py-1 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/25"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        {suggestedKind === "weekdays" ? "Weekdays" : suggestedKind === "saturday" ? "Saturday" : "Sunday"} (suggested)
                      </button>
                      {(["fallback", "weekdays", "saturday", "sunday"] as RoutineTemplateKind[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => tryApplyTemplate(k)}
                          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs capitalize text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/75"
                        >
                          {k}
                        </button>
                      ))}
                      <div className="ml-auto flex items-center gap-1.5">
                        <InfoTooltip text="Templates are managed under the Templates tab. Loading one replaces today's ad-hoc list." />
                        {state.adHocByDate[todayK] != null && (
                          <button
                            type="button"
                            onClick={clearAdHocForToday}
                            className="text-[11px] text-amber-400/70 transition-colors hover:text-amber-300"
                          >
                            Clear today
                          </button>
                        )}
                      </div>
                    </div>

                    <CapacityWarning userId={userId} plannedMinutes={plannedMinutesToday} />

                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                      <TimelineView
                        forDate={viewDate}
                        tasks={scheduledTasks}
                        onTaskTimeChange={upsertTaskTime}
                        onCreateRange={(start, end) =>
                          setModal({ mode: "create", initialRange: { start, end } })
                        }
                        onEditTask={(taskId) => setModal({ mode: "edit", taskId })}
                        onToggleDone={toggleTaskDone}
                        externalDropContainerRef={unscheduledRailRef}
                        onExternalDrop={upsertTaskTime}
                        sessions={sessions}
                        autoCompleteThreshold={prefs.autoCompleteThreshold}
                        unscheduledGaps={unscheduledGaps}
                        idleRanges={todayIdleRanges}
                        onGapClick={setGapModal}
                        nowMinutes={isViewingToday ? localMinutesNow() : null}
                        onMarkOfflineComplete={markOfflineComplete}
                        onMarkSkipped={markSkipped}
                      />
                      <UnscheduledRail
                        ref={unscheduledRailRef}
                        tasks={unscheduledTasks}
                        onCreate={quickCreateUnscheduled}
                        onEdit={(taskId) => setModal({ mode: "edit", taskId })}
                        onDelete={deleteTask}
                        onToggleDone={toggleTaskDone}
                      />
                    </div>
                </>
              )}
            </div>
          )}

          {tab === "routines" && (
            <div>
              <SectionHeader
                label="Recurring routines"
                tooltip="Define each routine once (frequency + domain tags). Add copies it into a template or today’s first task block — it does not appear on Today until you add it."
              />
              <RecurringRoutinesPanel
                rules={state.recurringRules}
                newId={newIdFn}
                onAdd={(rule) => {
                  const addedToday = addRecurringRule(rule);
                  if (addedToday) toast.success(`"${rule.title}" added to today's plan`);
                }}
                onReplace={(rule) => {
                  const effect = replaceRecurringRule(rule);
                  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
                  if (effect === "removed") toast.info(`"${rule.title}" removed from ${todayName}'s plan`);
                  if (effect === "added") toast.success(`"${rule.title}" added to today's plan`);
                }}
                onRemove={(id) => {
                  const title = removeRecurringRule(id);
                  if (title) toast.info(`"${title}" removed from recurring tasks and today's plan`);
                }}
                onAppendToTemplate={appendRecurringRuleToTemplate}
                onAppendToToday={(rule) => {
                  const isDuplicate = appendRecurringRuleToToday(rule);
                  if (isDuplicate) setConfirmDuplicateRule(rule);
                }}
              />
            </div>
          )}

          {tab === "templates" && (
            <RoutineTemplatesEditor
              state={state}
              setRoutineTemplate={setRoutineTemplate}
              newIdFn={newIdFn}
            />
          )}

          {/* {tab === "inbox" && (  // coming soon
            <div>
              <SectionHeader
                label="Inbox"
                tooltip="Persistent backlog not tied to any date. Capture ideas here and pull them into Today's ad-hoc list when you're ready."
              />
              <DayDataEditor
                data={state.taskDump}
                onChange={(d) => setTaskDump(d)}
                newIdFn={newIdFn}
              />
            </div>
          )} */}
        </motion.div>
      </AnimatePresence>

      {/* Duplicate recurring task modal */}
      {confirmDuplicateRule !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0f16] p-7 shadow-2xl"
          >
            <h3 className="mb-2 text-base font-semibold text-white">Already in today&apos;s plan</h3>
            <p className="mb-6 text-sm leading-relaxed text-white/50">
              <span className="text-white/75 font-medium">&ldquo;{confirmDuplicateRule.title}&rdquo;</span> is already in today&apos;s plan. Do you still want to add another copy?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDuplicateRule(null)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 transition hover:text-white/80"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  forceAppendRecurringRuleToToday(confirmDuplicateRule);
                  toast.success(`"${confirmDuplicateRule.title}" added to today's plan`);
                  setConfirmDuplicateRule(null);
                }}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
              >
                Add anyway
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Background-activity modal — Phase 3 */}
      {gapModal && (
        <BackgroundActivityModal
          gap={gapModal}
          scheduledTasks={scheduledTasks}
          onAssignToTask={(taskId) => assignGapToTask(gapModal, taskId)}
          onMarkIdle={() => markGapIdle(gapModal)}
          onCopyAsTask={() => copyGapAsTask(gapModal)}
          onClose={() => setGapModal(null)}
        />
      )}

      {/* Timeline task modal (create / edit) */}
      {modal && (modal.mode === "create" || taskBeingEdited) && (
        <TimelineTaskModal
          initial={modal.mode === "edit" ? taskBeingEdited : null}
          initialRange={modal.mode === "create" ? modal.initialRange : undefined}
          onClose={() => setModal(null)}
          onSave={(draft) => {
            if (modal.mode === "edit" && taskBeingEdited) {
              updateTaskFromModal(taskBeingEdited.id, draft);
            } else {
              createTaskFromModal(draft);
            }
            setModal(null);
          }}
          onDelete={
            modal.mode === "edit" && taskBeingEdited
              ? () => deleteTask(taskBeingEdited.id)
              : undefined
          }
        />
      )}

      {/* Confirm-template modal — replaces native window.confirm */}
      {confirmTemplate !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0f16] p-7 shadow-2xl"
          >
            <h3 className="mb-2 text-base font-semibold text-white">Replace today&apos;s tasks?</h3>
            <p className="mb-6 text-sm leading-relaxed text-white/50">
              Your current ad-hoc tasks for today will be overwritten with this template.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTemplate(null)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 transition hover:text-white/80"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  applyRoutineTemplateToToday(confirmTemplate);
                  toast.success(`${confirmTemplate.charAt(0).toUpperCase() + confirmTemplate.slice(1)} template loaded`);
                  setConfirmTemplate(null);
                }}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
              >
                Replace
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
