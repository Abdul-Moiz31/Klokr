"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader } from "@/components/ui/Loader";
import { RecurringRoutinesPanel } from "./RecurringRoutinesPanel";
import { PastDayView } from "./PastDayView";
import { RoutineTemplatesEditor } from "./RoutineTemplatesEditor";
import { TimelineView } from "./TimelineView";
import { WeekView } from "./WeekView";
import { CapacityWarning } from "./CapacityWarning";
import { UnscheduledRail } from "./UnscheduledRail";
import { TimelineTaskModal, type TimelineTaskDraft } from "./TimelineTaskModal";
import { ExtensionPlannerSync } from "@/components/ExtensionPlannerSync";
import { useDailyPlannerState } from "@/lib/daily-planner/useDailyPlannerState";
import { useTodaySessions } from "@/lib/daily-planner/useTodaySessions";
import { findUnscheduledGaps, type UnscheduledGap } from "@/lib/daily-planner/onTask";
import { localMinutesNow, pickAutoCompletions } from "@/lib/daily-planner/autoComplete";
import { createEmptyDayData, dayKey } from "@/lib/daily-planner/storage";
import { suggestedRoutineTemplateKind } from "@/lib/daily-planner/date";
import { normalizeRange, formatRange } from "@/lib/daily-planner/timeline";
import { DEFAULT_PREFS, loadPrefs, type KlokrsPrefs } from "@/lib/prefs";
import { BackgroundActivityModal } from "./BackgroundActivityModal";
import type {
  DayData,
  PlannerTask,
  RecurringRule,
  RoutineTemplateKind,
} from "@/lib/daily-planner/types";

/* ── Display labels (user-facing names for template kinds) ── */
const TEMPLATE_DISPLAY: Record<RoutineTemplateKind, { label: string; sub: string }> = {
  weekdays: { label: "Work day",  sub: "Mon–Fri" },
  saturday: { label: "Saturday",  sub: "Weekend" },
  sunday:   { label: "Sunday",    sub: "Weekend" },
  fallback: { label: "Recovery day", sub: "Light schedule" },
};

const TABS = [
  {
    id: "today",
    label: "Today",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "week",
    label: "Week",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="4" x2="9" y2="22" /><line x1="15" y1="4" x2="15" y2="22" />
      </svg>
    ),
  },
  {
    id: "routines",
    label: "Routines",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
    ),
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
  },
] as const;

function fmtTime(min: number): string {
  const total = Math.round(min);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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

function startOfWeekLocal(d: Date): Date {
  const base = startOfLocalDay(d);
  base.setDate(base.getDate() - base.getDay());
  return base;
}

function weekRangeLabel(anchor: Date): string {
  const start = startOfWeekLocal(anchor);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const s = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${s} – ${e}`;
}

type DailyPlannerAppProps = {
  accountCreatedAt?: string | null;
  userId?: string | null;
};

export function DailyPlannerApp({ accountCreatedAt = null, userId = null }: DailyPlannerAppProps = {}) {
  const {
    state,
    hydrated,
    getTodayKey,
    setTodayAdHoc,
    setAdHocForDate,
    clearAdHocForToday,
    addRecurringRule,
    replaceRecurringRule,
    removeRecurringRule,
    appendRecurringRuleToTemplate,
    appendRecurringRuleToToday,
    forceAppendRecurringRuleToToday,
    getTrackingRules,
    applyRoutineTemplateToToday,
    applyRoutineTemplateToDate,
    setRoutineTemplate,
    setTemplateTaskDomains,
    newId: newIdFn,
  } = useDailyPlannerState();

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("today");
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [prefs, setPrefs] = useState<KlokrsPrefs>(DEFAULT_PREFS);
  const [tplMenuOpen, setTplMenuOpen] = useState(false);

  // Week-view template picker (two-step: choose template kind, then target day)
  const [weekTplKind, setWeekTplKind] = useState<RoutineTemplateKind>("weekdays");
  const [weekTplDayIdx, setWeekTplDayIdx] = useState<string>("");

  useEffect(() => {
    setPrefs(loadPrefs());
    const reload = () => setPrefs(loadPrefs());
    const onVis = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const { sessions } = useTodaySessions(viewDate);
  const [confirmTemplate, setConfirmTemplate] = useState<RoutineTemplateKind | null>(null);
  const [confirmWeekTemplate, setConfirmWeekTemplate] = useState<
    { kind: RoutineTemplateKind; dateKey: string; label: string } | null
  >(null);
  const [confirmDuplicateRule, setConfirmDuplicateRule] = useState<RecurringRule | null>(null);
  const [modal, setModal] = useState<
    | { mode: "create"; initialRange?: { start: number; end: number }; dayKey?: string }
    | { mode: "edit"; taskId: string; dayKey?: string }
    | null
  >(null);
  const [gapModal, setGapModal] = useState<UnscheduledGap | null>(null);
  const ignoredAutoCompleteRef = useRef<Set<string>>(new Set());
  const [autoCompleteTick, setAutoCompleteTick] = useState(0);
  const unscheduledRailRef = useRef<HTMLDivElement | null>(null);

  const todayK = getTodayKey();
  const viewK = dayKey(viewDate);
  const isViewingToday = viewK === todayK;
  const now = new Date();

  const minViewableDay = useMemo(() => parseCreatedAtToLocalDay(accountCreatedAt), [accountCreatedAt]);
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
    () => scheduledTasks.reduce((sum, t) => sum + ((t.endMinutes as number) - (t.startMinutes as number)), 0),
    [scheduledTasks]
  );
  const unscheduledTasks = useMemo(() => todayAdHoc.tasks.filter((t) => t.startMinutes == null), [todayAdHoc]);
  const doneCount = useMemo(() => scheduledTasks.filter((t) => t.done).length, [scheduledTasks]);

  const activeTask = useMemo<PlannerTask | null>(() => {
    const nowMin = localMinutesNow();
    return scheduledTasks.find(
      (t) => !t.done && t.startMinutes != null && t.endMinutes != null &&
             t.startMinutes <= nowMin && t.endMinutes > nowMin
    ) ?? null;
  // autoCompleteTick ensures this re-derives every minute
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledTasks, autoCompleteTick]);

  const nextTask = useMemo<PlannerTask | null>(() => {
    const nowMin = localMinutesNow();
    return (
      scheduledTasks
        .filter((t) => !t.done && t.startMinutes != null && t.startMinutes > nowMin)
        .sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0))[0] ?? null
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledTasks, autoCompleteTick]);
  const todayIdleRanges = todayAdHoc.idleRanges ?? [];
  const hasAdHocToday = state?.adHocByDate[todayK] != null;

  useEffect(() => {
    if (!isViewingToday) return;
    const id = setInterval(() => setAutoCompleteTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [isViewingToday]);

  useEffect(() => {
    if (!isViewingToday) return;
    if (!prefs.autoCompleteEnabled) return;
    if (scheduledTasks.length === 0) return;
    const nowMin = localMinutesNow();
    const picks = pickAutoCompletions(scheduledTasks, sessions, viewDate, prefs, nowMin, ignoredAutoCompleteRef.current);
    if (picks.length === 0) return;
    const pickIds = new Set(picks.map((p) => p.taskId));
    setTodayTasks((tasks) =>
      tasks.map((t) => {
        const p = picks.find((x) => x.taskId === t.id);
        if (!p) return t;
        return { ...t, done: true, autoCompleted: true, completedAt: p.completedAt };
      })
    );
    void pickIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewingToday, scheduledTasks, sessions, prefs.autoCompleteEnabled, prefs.autoCompleteThreshold, viewDate, autoCompleteTick]);

  const unscheduledGaps = useMemo(() => {
    const raw = findUnscheduledGaps(scheduledTasks, sessions, viewDate, prefs.redBlockMinGapMinutes);
    if (todayIdleRanges.length === 0) return raw;
    return raw.filter((g) => !todayIdleRanges.some((r) => r.fromMinutes <= g.fromMinutes && r.toMinutes >= g.toMinutes));
  }, [scheduledTasks, sessions, viewDate, prefs.redBlockMinGapMinutes, todayIdleRanges]);

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

  const setTodayTasks = (mutate: (tasks: PlannerTask[]) => PlannerTask[]) => {
    const next = mutate(todayAdHoc.tasks);
    setTodayAdHoc({ ...todayAdHoc, tasks: next });
  };

  const upsertTaskTime = (taskId: string, startMinutes: number, endMinutes: number) => {
    const range = normalizeRange(startMinutes, endMinutes);
    setTodayTasks((tasks) =>
      tasks.map((t) => t.id === taskId ? { ...t, startMinutes: range.start, endMinutes: range.end } : t)
    );
  };

  const getDayData = (key: string): DayData => (state?.adHocByDate[key] ?? createEmptyDayData());
  const mutateDay = (key: string, mutate: (d: DayData) => DayData) => setAdHocForDate(key, mutate(getDayData(key)));

  const weekUpsertTaskTime = (dayDate: Date, taskId: string, startMinutes: number, endMinutes: number) => {
    const range = normalizeRange(startMinutes, endMinutes);
    const targetKey = dayKey(dayDate);
    let sourceKey: string | null = null;
    let moved: PlannerTask | null = null;
    if (state) {
      for (const [k, d] of Object.entries(state.adHocByDate)) {
        const found = d?.tasks.find((t) => t.id === taskId);
        if (found) { sourceKey = k; moved = found; break; }
      }
    }
    if (sourceKey === targetKey || sourceKey == null) {
      mutateDay(targetKey, (d) => ({ ...d, tasks: d.tasks.map((t) => t.id === taskId ? { ...t, startMinutes: range.start, endMinutes: range.end } : t) }));
      return;
    }
    mutateDay(sourceKey, (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== taskId) }));
    const taskMoved = moved!;
    mutateDay(targetKey, (d) => ({ ...d, tasks: [...d.tasks, { ...taskMoved, startMinutes: range.start, endMinutes: range.end }] }));
  };

  const weekCreateRange = (dayDate: Date, startMinutes: number, endMinutes: number) => {
    setModal({ mode: "create", initialRange: { start: startMinutes, end: endMinutes }, dayKey: dayKey(dayDate) });
  };

  const weekEditTask = (dayDate: Date, taskId: string) => {
    setModal({ mode: "edit", taskId, dayKey: dayKey(dayDate) });
  };

  const createTaskForDay = (key: string, draft: TimelineTaskDraft) => {
    const day = getDayData(key);
    const { data, groupId } = ensureFirstGroupId(day);
    const maxOrder = data.tasks.filter((t) => t.groupId === groupId).reduce((m, t) => Math.max(m, t.order), -1);
    const newTask: PlannerTask = { id: newIdFn(), groupId, title: draft.title, description: draft.description, done: draft.done, domainTags: draft.domainTags, order: maxOrder + 1, startMinutes: draft.startMinutes, endMinutes: draft.endMinutes };
    setAdHocForDate(key, { ...data, tasks: [...data.tasks, newTask] });
  };

  const updateTaskForDay = (key: string, taskId: string, draft: TimelineTaskDraft) => {
    mutateDay(key, (d) => ({ ...d, tasks: d.tasks.map((t) => t.id === taskId ? { ...t, title: draft.title, description: draft.description, done: draft.done, domainTags: draft.domainTags, startMinutes: draft.startMinutes, endMinutes: draft.endMinutes } : t) }));
  };

  const deleteTaskForDay = (key: string, taskId: string) => {
    mutateDay(key, (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== taskId) }));
  };

  const createTaskFromModal = (draft: TimelineTaskDraft) => {
    const { data, groupId } = ensureFirstGroupId(todayAdHoc);
    const maxOrder = data.tasks.filter((t) => t.groupId === groupId).reduce((m, t) => Math.max(m, t.order), -1);
    const newTask: PlannerTask = { id: newIdFn(), groupId, title: draft.title, description: draft.description, done: draft.done, domainTags: draft.domainTags, order: maxOrder + 1, startMinutes: draft.startMinutes, endMinutes: draft.endMinutes };
    setTodayAdHoc({ ...data, tasks: [...data.tasks, newTask] });
  };

  const updateTaskFromModal = (taskId: string, draft: TimelineTaskDraft) => {
    let propagateTo: { kind: RoutineTemplateKind; templateTaskId: string } | null = null;
    setTodayTasks((tasks) =>
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        if (draft.applyDomainsToTemplate && t.sourceTemplateTaskId && t.sourceTemplateKind) {
          propagateTo = { kind: t.sourceTemplateKind, templateTaskId: t.sourceTemplateTaskId };
        }
        return { ...t, title: draft.title, description: draft.description, done: draft.done, domainTags: draft.domainTags, startMinutes: draft.startMinutes, endMinutes: draft.endMinutes };
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

  const deleteTask = (taskId: string) => setTodayTasks((tasks) => tasks.filter((t) => t.id !== taskId));

  const toggleTaskDone = (taskId: string) => {
    setTodayTasks((tasks) =>
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        const nextDone = !t.done;
        if (!nextDone && t.autoCompleted) {
          ignoredAutoCompleteRef.current.add(t.id);
          return { ...t, done: false, autoCompleted: false, completedAt: undefined };
        }
        if (nextDone) return { ...t, done: true, completedAt: Date.now() };
        return { ...t, done: false, completedAt: undefined };
      })
    );
  };

  const markOfflineComplete = (taskId: string) => {
    setTodayTasks((tasks) => tasks.map((t) => t.id === taskId ? { ...t, done: true, completedAt: Date.now() } : t));
    toast.success("Marked complete");
  };

  const markSkipped = (taskId: string) => {
    setTodayTasks((tasks) => tasks.map((t) => t.id === taskId ? { ...t, skipped: true } : t));
    toast.success("Marked skipped");
  };

  const assignGapToTask = (gap: UnscheduledGap, taskId: string) => {
    const now = Date.now();
    setTodayTasks((tasks) =>
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        const prev = t.manualAttributions ?? [];
        return { ...t, manualAttributions: [...prev, { fromMinutes: gap.fromMinutes, toMinutes: gap.toMinutes, addedMinutes: Math.round(gap.activityMinutes), addedAt: now }] };
      })
    );
    setGapModal(null);
    toast.success("Background activity assigned");
  };

  const markGapIdle = (gap: UnscheduledGap) => {
    const now = Date.now();
    const prev = todayAdHoc.idleRanges ?? [];
    setTodayAdHoc({ ...todayAdHoc, idleRanges: [...prev, { fromMinutes: gap.fromMinutes, toMinutes: gap.toMinutes, markedAt: now }] });
    setGapModal(null);
    toast.success("Marked as idle");
  };

  const copyGapAsTask = (gap: UnscheduledGap) => {
    setGapModal(null);
    setModal({ mode: "create", initialRange: { start: gap.fromMinutes, end: gap.toMinutes } });
  };

  const quickCreateUnscheduled = (title: string) => {
    const { data, groupId } = ensureFirstGroupId(todayAdHoc);
    const maxOrder = data.tasks.filter((t) => t.groupId === groupId).reduce((m, t) => Math.max(m, t.order), -1);
    const newTask: PlannerTask = { id: newIdFn(), groupId, title, description: "", done: false, domainTags: [], order: maxOrder + 1, startMinutes: null, endMinutes: null };
    setTodayAdHoc({ ...data, tasks: [...data.tasks, newTask] });
  };

  const taskBeingEdited = modal?.mode === "edit"
    ? (modal.dayKey ? getDayData(modal.dayKey).tasks.find((t) => t.id === modal.taskId) : todayAdHoc.tasks.find((t) => t.id === modal.taskId)) ?? null
    : null;

  const tryApplyTemplate = (kind: RoutineTemplateKind) => {
    if (!state) return;
    if (state.adHocByDate[todayK] != null) { setConfirmTemplate(kind); return; }
    applyRoutineTemplateToToday(kind);
    toast.success(`${TEMPLATE_DISPLAY[kind].label} template loaded`);
  };

  if (!hydrated || !state) return <Loader />;

  return (
    <div className="w-full max-w-7xl">
      <ExtensionPlannerSync rules={rules} />

      {/* ── Tab bar ── */}
      <div className="mb-7 flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); if (t.id === "today") setViewDate(new Date()); }}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive ? "bg-violet-600/25 text-violet-200 shadow-sm" : "text-white/40 hover:text-white/65 hover:bg-white/[0.04]"
              }`}
            >
              <span className={isActive ? "text-violet-300/80" : "text-white/30"}>{t.icon}</span>
              {t.label}
              {isActive && (
                <motion.div layoutId="tab-indicator" className="absolute inset-0 rounded-xl border border-violet-500/20" transition={{ duration: 0.2, ease: "easeInOut" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >

          {/* ════ TODAY ════ */}
          {tab === "today" && (
            <div>

              {/* ── Slim date nav ── */}
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewDate((d) => addDays(d, -1))}
                  disabled={atEarliestDay}
                  title={atEarliestDay && minViewableDay ? `You joined on ${formatJoinedDate(minViewableDay)}` : undefined}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-20"
                  aria-label="Previous day"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>

                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="text-base font-bold text-white/95">{isViewingToday ? "Today" : "Past day"}</span>
                  <span className="text-sm text-white/35">{formatNavDate(viewDate)}</span>
                  {!isViewingToday && (
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/35">Past</span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {isViewingToday && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setTplMenuOpen((v) => !v)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-white/30 transition hover:bg-white/[0.06] hover:text-white/65"
                      >
                        Template
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                      {tplMenuOpen && (
                        <>
                          <button
                            type="button"
                            aria-label="Close menu"
                            className="fixed inset-0 z-10 cursor-default"
                            onClick={() => setTplMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-full z-20 mt-1 flex flex-col gap-0.5 rounded-lg border border-white/10 bg-[#12121a] p-1 shadow-xl">
                            {(["weekdays", "saturday", "sunday", "fallback"] as RoutineTemplateKind[]).map((k) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => { tryApplyTemplate(k); setTplMenuOpen(false); }}
                                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition ${
                                  k === suggestedKind
                                    ? "text-violet-200 hover:bg-violet-500/15"
                                    : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                                }`}
                              >
                                {TEMPLATE_DISPLAY[k].label}
                                {k === suggestedKind && <span className="ml-1.5 text-[9px] text-violet-400/70">suggested</span>}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {!isViewingToday && (
                    <button
                      type="button"
                      onClick={() => setViewDate(new Date())}
                      className="rounded-lg border border-violet-500/25 bg-violet-600/15 px-2.5 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/25"
                    >
                      Today
                    </button>
                  )}
                  {hasAdHocToday && isViewingToday && (
                    <button
                      type="button"
                      onClick={clearAdHocForToday}
                      className="rounded-lg px-2 py-1 text-[11px] font-medium text-red-400/40 transition hover:bg-red-500/[0.06] hover:text-red-300"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewDate((d) => addDays(d, 1))}
                    disabled={isViewingToday}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-20"
                    aria-label="Next day"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                </div>
              </div>

              {/* ── Inline stats strip (today only) ── */}
              {isViewingToday && scheduledTasks.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2">
                  <span className="text-xs text-white/55">
                    <span className={`font-semibold tabular-nums ${doneCount > 0 ? "text-emerald-300" : "text-white/70"}`}>{doneCount}</span>
                    <span className="text-white/30">/{scheduledTasks.length} done</span>
                  </span>
                  <span className="text-white/15">·</span>
                  <span className="text-xs text-white/45 tabular-nums">
                    {plannedMinutesToday > 0 ? fmtTime(plannedMinutesToday) : "—"} planned
                  </span>
                  <div className="ml-1 h-1 min-w-[64px] flex-1 max-w-[220px] overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full"
                      animate={{ width: `${Math.max(doneCount > 0 ? 2 : 0, (doneCount / scheduledTasks.length) * 100)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      style={{
                        background:
                          doneCount === scheduledTasks.length
                            ? "linear-gradient(90deg,#10b981,#06b6d4)"
                            : "linear-gradient(90deg,#7c3aed,#0891b2)",
                      }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-white/30">
                    {Math.round((doneCount / scheduledTasks.length) * 100)}%
                  </span>
                </div>
              )}

              {/* Empty-state template prompt (today only, nothing scheduled yet) */}
              {isViewingToday && scheduledTasks.length === 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                  <span className="text-xs text-white/35">Nothing scheduled yet — load a template:</span>
                  {(["weekdays", "saturday", "sunday", "fallback"] as RoutineTemplateKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => tryApplyTemplate(k)}
                      className={`rounded-lg border px-2 py-0.5 text-[10px] font-medium transition-all ${
                        k === suggestedKind
                          ? "border-violet-500/35 bg-violet-600/15 text-violet-200 hover:bg-violet-500/25"
                          : "border-white/[0.07] bg-transparent text-white/35 hover:border-white/15 hover:text-white/65"
                      }`}
                    >
                      {TEMPLATE_DISPLAY[k].label}
                    </button>
                  ))}
                </div>
              )}

              {/* Past day: read-only */}
              {!isViewingToday ? (
                <AnimatePresence mode="wait">
                  <motion.div key={viewK} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                    <PastDayView state={state} forDate={viewDate} sessions={sessions} autoCompleteThreshold={prefs.autoCompleteThreshold} />
                  </motion.div>
                </AnimatePresence>
              ) : (
                <>
                  <CapacityWarning userId={userId} plannedMinutes={plannedMinutesToday} />

                  <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                    <TimelineView
                      forDate={viewDate}
                      tasks={scheduledTasks}
                      onTaskTimeChange={upsertTaskTime}
                      onCreateRange={(start, end) => setModal({ mode: "create", initialRange: { start, end } })}
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

                    {/* ── Right panel ── */}
                    <div className="flex flex-col gap-3">

                      {/* Active now / Up next */}
                      {(activeTask ?? nextTask) && (
                        <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
                          <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5">
                            {activeTask ? (
                              <>
                                <span className="relative flex h-2 w-2">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                                </span>
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/70">Active now</span>
                              </>
                            ) : (
                              <>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Up next</span>
                              </>
                            )}
                          </div>
                          <div className="p-4">
                            {(() => {
                              const t = (activeTask ?? nextTask)!;
                              const dur = (t.endMinutes ?? 0) - (t.startMinutes ?? 0);
                              const elapsed = activeTask
                                ? Math.max(0, localMinutesNow() - (activeTask.startMinutes ?? 0))
                                : null;
                              const pct = elapsed != null && dur > 0 ? Math.min(100, (elapsed / dur) * 100) : 0;
                              return (
                                <>
                                  <p className="mb-1 text-sm font-semibold leading-snug text-white/90">{t.title || "(untitled)"}</p>
                                  <p className="text-[11px] tabular-nums text-white/40">
                                    {formatRange(t.startMinutes!, t.endMinutes!)} · {fmtTime(dur)}
                                  </p>
                                  {activeTask && (
                                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                                      <div
                                        className="h-full rounded-full bg-emerald-400/60 transition-all duration-1000"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Unscheduled tasks */}
                      <UnscheduledRail
                        ref={unscheduledRailRef}
                        tasks={unscheduledTasks}
                        onCreate={quickCreateUnscheduled}
                        onEdit={(taskId) => setModal({ mode: "edit", taskId })}
                        onDelete={deleteTask}
                        onToggleDone={toggleTaskDone}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════ WEEK ════ */}
          {tab === "week" && (
            <div>
              {/* Week navigation bar */}
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                {/* Prev / week range / next */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setWeekAnchor((d) => addDays(d, -7))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white/80"
                    aria-label="Previous week"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <span className="min-w-[8rem] text-center text-base font-bold text-white/90">{weekRangeLabel(weekAnchor)}</span>
                  <button
                    type="button"
                    onClick={() => setWeekAnchor((d) => addDays(d, 7))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white/80"
                    aria-label="Next week"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                  {startOfWeekLocal(weekAnchor).getTime() !== startOfWeekLocal(new Date()).getTime() && (
                    <button
                      type="button"
                      onClick={() => setWeekAnchor(new Date())}
                      className="rounded-lg border border-violet-500/25 bg-violet-600/15 px-2.5 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/25"
                    >
                      This week
                    </button>
                  )}
                </div>

                {/* Template loader — two-step: pick template type, then pick the day */}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="hidden text-[11px] text-white/30 sm:block">Load template:</span>
                  <select
                    value={weekTplKind}
                    onChange={(e) => setWeekTplKind(e.target.value as RoutineTemplateKind)}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 [color-scheme:dark] focus:border-violet-500/40 focus:outline-none"
                  >
                    {(["weekdays", "saturday", "sunday", "fallback"] as RoutineTemplateKind[]).map((k) => (
                      <option key={k} value={k}>{TEMPLATE_DISPLAY[k].label}</option>
                    ))}
                  </select>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/20"><path d="M9 18l6-6-6-6" /></svg>
                  <select
                    value={weekTplDayIdx}
                    onChange={(e) => setWeekTplDayIdx(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 [color-scheme:dark] focus:border-violet-500/40 focus:outline-none"
                  >
                    <option value="">Pick a day…</option>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                      <option key={i} value={String(i)}>{d}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!weekTplDayIdx}
                    onClick={() => {
                      if (!weekTplDayIdx) return;
                      const target = addDays(startOfWeekLocal(weekAnchor), Number(weekTplDayIdx));
                      setConfirmWeekTemplate({ kind: weekTplKind, dateKey: dayKey(target), label: formatNavDate(target) });
                      setWeekTplDayIdx("");
                    }}
                    className="rounded-lg border border-violet-500/25 bg-violet-600/15 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <WeekView
                anchorDate={weekAnchor}
                adHocByDate={state.adHocByDate}
                routineTemplates={state.routineTemplates}
                minViewableDay={minViewableDay}
                onTaskTimeChange={weekUpsertTaskTime}
                onCreateRange={weekCreateRange}
                onEditTask={weekEditTask}
              />
            </div>
          )}

          {/* ════ ROUTINES ════ */}
          {tab === "routines" && (
            <div>
              <div className="mb-5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
                <p className="text-sm font-semibold text-white/80">Recurring routines</p>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Build a library of tasks you do regularly — morning review, deep work blocks, email check. Once saved, add them to a template or drop them straight onto today.
                </p>
              </div>
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
                  if (title) toast.info(`"${title}" removed`);
                }}
                onAppendToTemplate={appendRecurringRuleToTemplate}
                onAppendToToday={(rule) => {
                  const isDuplicate = appendRecurringRuleToToday(rule);
                  if (isDuplicate) setConfirmDuplicateRule(rule);
                }}
              />
            </div>
          )}

          {/* ════ TEMPLATES ════ */}
          {tab === "templates" && (
            <RoutineTemplatesEditor
              state={state}
              setRoutineTemplate={setRoutineTemplate}
              newIdFn={newIdFn}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Duplicate routine modal ── */}
      {confirmDuplicateRule !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0f0f16] p-7 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold text-white">Already in today&apos;s plan</h3>
            <p className="mb-6 text-sm leading-relaxed text-white/50">
              <span className="font-medium text-white/75">&ldquo;{confirmDuplicateRule.title}&rdquo;</span> is already here. Add another copy?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDuplicateRule(null)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 transition hover:text-white/80">Cancel</button>
              <button
                onClick={() => { forceAppendRecurringRuleToToday(confirmDuplicateRule); toast.success(`"${confirmDuplicateRule.title}" added`); setConfirmDuplicateRule(null); }}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
              >
                Add anyway
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Background activity modal ── */}
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

      {/* ── Timeline task modal ── */}
      {modal && (modal.mode === "create" || taskBeingEdited) && (
        <TimelineTaskModal
          initial={modal.mode === "edit" ? taskBeingEdited : null}
          initialRange={modal.mode === "create" ? modal.initialRange : undefined}
          onClose={() => setModal(null)}
          onSave={(draft) => {
            const dk = modal.dayKey;
            if (modal.mode === "edit" && taskBeingEdited) {
              if (dk) updateTaskForDay(dk, taskBeingEdited.id, draft);
              else updateTaskFromModal(taskBeingEdited.id, draft);
            } else {
              if (dk) createTaskForDay(dk, draft);
              else createTaskFromModal(draft);
            }
            setModal(null);
          }}
          onDelete={
            modal.mode === "edit" && taskBeingEdited
              ? () => (modal.dayKey ? deleteTaskForDay(modal.dayKey, taskBeingEdited.id) : deleteTask(taskBeingEdited.id))
              : undefined
          }
        />
      )}

      {/* ── Confirm replace today's tasks ── */}
      {confirmTemplate !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0f0f16] p-7 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold text-white">Replace today&apos;s tasks?</h3>
            <p className="mb-6 text-sm leading-relaxed text-white/50">
              Your current tasks for today will be replaced with the <span className="font-medium text-white/75">{TEMPLATE_DISPLAY[confirmTemplate].label}</span> template.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmTemplate(null)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 transition hover:text-white/80">Cancel</button>
              <button
                onClick={() => { applyRoutineTemplateToToday(confirmTemplate); toast.success(`${TEMPLATE_DISPLAY[confirmTemplate].label} template loaded`); setConfirmTemplate(null); }}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
              >
                Replace
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Confirm load template into a week day ── */}
      {confirmWeekTemplate !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0f0f16] p-7 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold text-white">
              Load {TEMPLATE_DISPLAY[confirmWeekTemplate.kind].label} into {confirmWeekTemplate.label}?
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-white/50">
              Any existing tasks on {confirmWeekTemplate.label} will be replaced.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmWeekTemplate(null)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 transition hover:text-white/80">Cancel</button>
              <button
                onClick={() => {
                  applyRoutineTemplateToDate(confirmWeekTemplate.kind, confirmWeekTemplate.dateKey);
                  toast.success(`${TEMPLATE_DISPLAY[confirmWeekTemplate.kind].label} loaded into ${confirmWeekTemplate.label}`);
                  setConfirmWeekTemplate(null);
                }}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
              >
                Load
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
