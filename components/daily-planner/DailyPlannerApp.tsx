"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Loader } from "@/components/ui/Loader";
import { DayDataEditor } from "./DayDataEditor";
import { RecurringRoutinesPanel } from "./RecurringRoutinesPanel";
import { PastDayView } from "./PastDayView";
import { RoutineTemplatesEditor } from "./RoutineTemplatesEditor";
import { ExtensionPlannerSync } from "@/components/ExtensionPlannerSync";
import { useDailyPlannerState } from "@/lib/daily-planner/useDailyPlannerState";
import { createEmptyDayData, dayKey } from "@/lib/daily-planner/storage";
import { suggestedRoutineTemplateKind } from "@/lib/daily-planner/date";
import type { DayData, RecurringRule, RoutineTemplateKind } from "@/lib/daily-planner/types";

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
    appendRecurringRuleToTemplate,
    appendRecurringRuleToToday,
    forceAppendRecurringRuleToToday,
    getTrackingRules,
    applyRoutineTemplateToToday,
    setRoutineTemplate,
    newId: newIdFn,
  } = useDailyPlannerState();

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("today");
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [confirmTemplate, setConfirmTemplate] = useState<RoutineTemplateKind | null>(null);
  const [confirmDuplicateRule, setConfirmDuplicateRule] = useState<RecurringRule | null>(null);

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

                    <DayDataEditor
                      data={todayAdHoc}
                      onChange={(d) => setTodayAdHoc(d)}
                      newIdFn={newIdFn}
                    />
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
