"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Loader } from "@/components/ui/Loader";
import { DayDataEditor } from "./DayDataEditor";
import { TodayRecurringTable } from "./TodayRecurringTable";
import { RecurringRoutinesPanel } from "./RecurringRoutinesPanel";
import { ExtensionPlannerSync } from "@/components/ExtensionPlannerSync";
import { useDailyPlannerState } from "@/lib/daily-planner/useDailyPlannerState";
import { createEmptyDayData } from "@/lib/daily-planner/storage";
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
    tooltip: "Today's recurring routines + your one-off ad-hoc tasks. Check off tasks to exclude them from tracked tab time.",
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
    id: "inbox",
    label: "Task dump",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    tooltip: "A persistent backlog for tasks not tied to a specific day. Pull from here when planning or move tasks into Today's ad-hoc list.",
  },
] as const;

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
    newId: newIdFn,
  } = useDailyPlannerState();

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("today");
  const todayK = getTodayKey();
  const now = useMemo(() => new Date(), [todayK]);

  const todayAdHoc: DayData = useMemo(() => {
    if (!state) return createEmptyDayData();
    return state.adHocByDate[todayK] ?? createEmptyDayData();
  }, [state, todayK]);

  const rules = getTrackingRules();
  const suggestedKind = useMemo(
    () => suggestedRoutineTemplateKind(new Date()),
    [todayK]
  );

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
    <div className="w-full max-w-4xl">
      <ExtensionPlannerSync rules={rules} />

      {/* Tab bar */}
      <div className="mb-7 flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
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
                  <span className="text-[11px] text-white/30 mr-1">Load template:</span>
                  <button
                    type="button"
                    onClick={() => tryApplyTemplate(suggestedKind)}
                    className="flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-600/15 px-2.5 py-1 text-xs font-medium text-violet-300 hover:bg-violet-500/25 transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {suggestedKind === "weekdays" ? "Weekdays" : "Weekend"} (suggested)
                  </button>
                  {(["fallback", "weekdays", "weekend"] as RoutineTemplateKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => tryApplyTemplate(k)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/50 hover:bg-white/[0.08] hover:text-white/75 transition-colors capitalize"
                    >
                      {k}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-1.5">
                    <InfoTooltip text="Templates are managed under Routine templates in the sidebar. Loading one replaces today's ad-hoc list." />
                    {state.adHocByDate[todayK] != null && (
                      <button
                        type="button"
                        onClick={clearAdHocForToday}
                        className="text-[11px] text-amber-400/70 hover:text-amber-300 transition-colors"
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

          {tab === "inbox" && (
            <div>
              <SectionHeader
                label="Task dump"
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
