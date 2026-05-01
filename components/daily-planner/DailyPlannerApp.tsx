"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Loader } from "@/components/ui/Loader";
import { DayDataEditor } from "./DayDataEditor";
import { TodayRecurringTable } from "./TodayRecurringTable";
import { RecurringRoutinesPanel } from "./RecurringRoutinesPanel";
import { PastDayView } from "./PastDayView";
import { RoutineTemplatesEditor } from "./RoutineTemplatesEditor";
import { ExtensionPlannerSync } from "@/components/ExtensionPlannerSync";
import { useDailyPlannerState } from "@/lib/daily-planner/useDailyPlannerState";
import { createEmptyDayData, dayKey } from "@/lib/daily-planner/storage";
import { suggestedRoutineTemplateKind } from "@/lib/daily-planner/date";
import type { DayData, RoutineTemplateKind } from "@/lib/daily-planner/types";

const TABS = [
  {
    id: "today",
    label: "Today",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    tooltip: "Today's recurring routines + your one-off ad-hoc tasks. Use the date arrows to browse past days in journal mode.",
  },
  {
    id: "routines",
    label: "Recurring",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
    ),
    tooltip: "Define repeating routines — set frequency, weekdays, and domain tags. They appear automatically on Today for matching days.",
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
  {
    id: "inbox",
    label: "Inbox",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    tooltip: "A persistent backlog for tasks not tied to a specific day. Pull from here when planning or move tasks into Today's ad-hoc list.",
  },
] as const;

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
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

export function DailyPlannerApp() {
  const {
    state,
    hydrated,
    getTodayKey,
    setTodayAdHoc,
    setTaskDump,
    clearAdHocForToday,
    addRecurringRule,
    replaceRecurringRule,
    removeRecurringRule,
    toggleRecurringDone,
    getTrackingRules,
    applyRoutineTemplateToToday,
    setRoutineTemplate,
    newId: newIdFn,
  } = useDailyPlannerState();

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("today");
  const [viewDate, setViewDate] = useState<Date>(() => new Date());

  const todayK = getTodayKey();
  const viewK = dayKey(viewDate);
  const isViewingToday = viewK === todayK;
  const now = new Date();

  const todayAdHoc: DayData = useMemo(() => {
    if (!state) return createEmptyDayData();
    return state.adHocByDate[todayK] ?? createEmptyDayData();
  }, [state, todayK]);

  const rules = getTrackingRules();
  const suggestedKind = suggestedRoutineTemplateKind(now);

  const tryApplyTemplate = (kind: RoutineTemplateKind) => {
    if (!state) return;
    if (state.adHocByDate[todayK] != null) {
      const ok = window.confirm(
        "Replace today's ad-hoc list with this template? Your current ad-hoc tasks for today will be overwritten."
      );
      if (!ok) return;
    }
    applyRoutineTemplateToToday(kind);
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
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
                    <PastDayView state={state} forDate={viewDate} />
                  </motion.div>
                </AnimatePresence>
              ) : (
                /* Today: editable view */
                <>
                  <SectionHeader
                    label="Recurring for today"
                    tooltip="Routines from your Recurring tab that match today's day of week. Check them off — they reset tomorrow."
                  />
                  <TodayRecurringTable
                    state={state}
                    forDate={now}
                    onToggleDone={(ruleId) => toggleRecurringDone(ruleId, now)}
                  />

                  <div className="mt-8">
                    <SectionHeader
                      label="Ad-hoc tasks"
                      tooltip="One-off tasks just for today. Use a template to pre-fill groups, or add tasks manually. Domain tags link to tab tracking."
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

                    <DayDataEditor
                      data={todayAdHoc}
                      onChange={(d) => setTodayAdHoc(d)}
                      newIdFn={newIdFn}
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
                tooltip="One row per routine. Set frequency and weekdays — it surfaces on Today automatically and you check it off per day."
              />
              <RecurringRoutinesPanel
                rules={state.recurringRules}
                newId={newIdFn}
                onAdd={addRecurringRule}
                onReplace={replaceRecurringRule}
                onRemove={removeRecurringRule}
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

          {tab === "inbox" && (
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
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
