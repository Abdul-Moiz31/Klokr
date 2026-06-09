"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { DayDataEditor } from "./DayDataEditor";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { TemplateImportModal, type ParsedTask } from "./TemplateImportModal";
import type { DailyPlannerV5, DayData, PlannerTask, RoutineTemplateKind } from "@/lib/daily-planner/types";
import { createEmptyDayData } from "@/lib/daily-planner/storage";

const TEMPLATE_TABS: {
  kind: RoutineTemplateKind;
  label: string;
  sub: string;
  tooltip: string;
  icon: React.ReactNode;
}[] = [
  {
    kind: "weekdays",
    label: "Work day",
    sub: "Mon–Fri",
    tooltip: "Loaded automatically on weekdays. Edit the task blocks here to match your typical workday.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    kind: "saturday",
    label: "Saturday",
    sub: "Weekend",
    tooltip: "Loaded on Saturdays. Great for errands, hobbies, or personal projects.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 009 9 9 9 0 11-9-9z" />
      </svg>
    ),
  },
  {
    kind: "sunday",
    label: "Sunday",
    sub: "Weekend",
    tooltip: "Loaded on Sundays. Ideal for rest, weekly review, and planning the week ahead.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
  {
    kind: "fallback",
    label: "Recovery day",
    sub: "Light schedule",
    tooltip: "For when you're busy or overwhelmed — a lighter, more manageable set of tasks to fall back on instead of skipping your routine entirely.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
];

type Props = {
  state: DailyPlannerV5;
  setRoutineTemplate: (kind: RoutineTemplateKind, data: DayData) => void;
  newIdFn: () => string;
};

export function RoutineTemplatesEditor({ state, setRoutineTemplate, newIdFn }: Props) {
  const [selectedKind, setSelectedKind] = useState<RoutineTemplateKind>("weekdays");
  const [showImport, setShowImport] = useState(false);

  const activeTab = TEMPLATE_TABS.find((t) => t.kind === selectedKind)!;
  const data = state.routineTemplates[selectedKind] ?? createEmptyDayData();

  const handleImport = (parsed: ParsedTask[]) => {
    if (parsed.length === 0) return;

    // Replace the entire template with the imported tasks (fresh day data)
    const base = createEmptyDayData();
    const groupId = base.groups[0]!.id;

    const newTasks: PlannerTask[] = parsed.map((p, i) => ({
      id: newIdFn(),
      groupId,
      title: p.title,
      description: "",
      done: false,
      domainTags: [],
      order: i,
      startMinutes: p.startMinutes,
      endMinutes: p.endMinutes,
    }));

    setRoutineTemplate(selectedKind, { ...base, tasks: newTasks });
  };

  return (
    <div className="w-full max-w-7xl">
      {/* Header */}
      <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
        <p className="text-sm font-semibold text-white/80">Day templates</p>
        <p className="mt-1 text-xs leading-relaxed text-white/40">
          Set up reusable task lists for your most common day types. Load any template onto today (or any week day) with a single click from the Today and Week tabs.
        </p>
      </div>

      {/* Flat template selector — 4 equal cards */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TEMPLATE_TABS.map((t) => {
          const isActive = selectedKind === t.kind;
          return (
            <button
              key={t.kind}
              type="button"
              onClick={() => setSelectedKind(t.kind)}
              className={`flex flex-col items-start gap-1.5 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 ${
                isActive
                  ? "border-cyan-500/25 bg-cyan-600/10 shadow-sm"
                  : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
              }`}
            >
              <span className={isActive ? "text-cyan-300/80" : "text-white/30"}>{t.icon}</span>
              <span className={`text-sm font-semibold ${isActive ? "text-cyan-200" : "text-white/65"}`}>{t.label}</span>
              <span className={`text-[10px] ${isActive ? "text-cyan-300/40" : "text-white/20"}`}>{t.sub}</span>
            </button>
          );
        })}
      </div>

      {/* Active template label + actions */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-600/10 text-cyan-300/70">
          {activeTab.icon}
        </div>
        <p className="text-sm font-semibold text-white/75">{activeTab.label} template</p>
        <InfoTooltip text={activeTab.tooltip} side="bottom" />

        <div className="ml-auto flex items-center gap-2">
          {data.tasks.length > 0 && (
            <button
              type="button"
              onClick={() => setRoutineTemplate(selectedKind, createEmptyDayData())}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/15 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-red-400/60 transition hover:border-red-500/25 hover:bg-red-500/[0.06] hover:text-red-300"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" />
              </svg>
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/55 transition hover:border-violet-500/20 hover:bg-violet-500/[0.06] hover:text-violet-300"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import schedule
          </button>
        </div>
      </div>

      <DayDataEditor
        data={data}
        onChange={(d) => setRoutineTemplate(selectedKind, d)}
        newIdFn={newIdFn}
        isTemplate
      />

      {/* Import modal */}
      <AnimatePresence>
        {showImport && (
          <TemplateImportModal
            onImport={handleImport}
            onClose={() => setShowImport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
