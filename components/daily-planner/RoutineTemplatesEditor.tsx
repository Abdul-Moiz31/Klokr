"use client";

import { useState } from "react";
import { DayDataEditor } from "./DayDataEditor";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { DailyPlannerV2, DayData, RoutineTemplateKind } from "@/lib/daily-planner/types";
import { createEmptyDayData } from "@/lib/daily-planner/storage";

type MainRoutineTab = "weekdays" | "weekend" | "fallback";
type WeekendSubTab = "saturday" | "sunday";

const MAIN_TABS: {
  id: MainRoutineTab;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "weekdays",
    label: "Weekdays",
    tooltip: "Suggested Mon–Fri in the daily planner. Edit groups and tasks here to fit your typical workday.",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    id: "weekend",
    label: "Weekend",
    tooltip: "Weekend templates let you configure Saturday and Sunday separately for a more flexible plan.",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    ),
  },
  {
    id: "fallback",
    label: "Fallback",
    tooltip: "A generic starter you can copy to any day when the weekday or weekend preset doesn't fit.",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
];

const WEEKEND_SUB_TABS: {
  id: WeekendSubTab;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "saturday",
    label: "Saturday",
    tooltip: "Plan a separate Saturday routine for errands, hobbies, or prep work.",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 009 9 9 9 0 11-9-9z" />
      </svg>
    ),
  },
  {
    id: "sunday",
    label: "Sunday",
    tooltip: "Plan a separate Sunday routine for rest, review, and reset.",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
];

const ROUTINE_TEMPLATE_KINDS: {
  id: RoutineTemplateKind;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
}[] = [
  { ...MAIN_TABS.find((t) => t.id === "weekdays")!, id: "weekdays" },
  { ...MAIN_TABS.find((t) => t.id === "fallback")!, id: "fallback" },
  ...WEEKEND_SUB_TABS,
];

type Props = {
  state: DailyPlannerV2;
  setRoutineTemplate: (kind: RoutineTemplateKind, data: DayData) => void;
  newIdFn: () => string;
};

export function RoutineTemplatesEditor({ state, setRoutineTemplate, newIdFn }: Props) {
  const [mainTab, setMainTab] = useState<MainRoutineTab>("weekdays");
  const [weekendTab, setWeekendTab] = useState<WeekendSubTab>("saturday");

  const selectedKind: RoutineTemplateKind = mainTab === "weekend" ? weekendTab : mainTab;
  const data = state.routineTemplates[selectedKind] ?? createEmptyDayData();
  const activeKind = ROUTINE_TEMPLATE_KINDS.find((k) => k.id === selectedKind)!;

  return (
    <div className="w-full max-w-7xl">
      <div className="mb-6 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/30">Routine templates</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Reusable day starters for your planner</h2>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Keep your most common daily setups here and apply them quickly to any day. Use Weekdays, Weekend, and Fallback templates to match workdays, Saturday/Sunday, and last-minute days.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
        <div className="flex items-center gap-1">
          {MAIN_TABS.map((tabOption) => {
            const isActive = mainTab === tabOption.id;
            return (
              <button
                key={tabOption.id}
                type="button"
                onClick={() => setMainTab(tabOption.id)}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-cyan-600/20 text-cyan-200 shadow-sm"
                    : "text-white/40 hover:text-white/65 hover:bg-white/[0.04]"
                }`}
              >
                <span className={isActive ? "text-cyan-300/80" : "text-white/30"}>
                  {tabOption.icon}
                </span>
                {tabOption.label}
                {isActive && (
                  <div className="absolute inset-0 rounded-xl border border-cyan-500/20" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {mainTab === "weekend" && (
        <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="grid grid-cols-2 gap-2">
            {WEEKEND_SUB_TABS.map((subTab) => {
              const isActive = weekendTab === subTab.id;
              return (
                <button
                  key={subTab.id}
                  type="button"
                  onClick={() => setWeekendTab(subTab.id)}
                  className={`rounded-xl px-4 py-3 text-sm text-left transition ${
                    isActive
                      ? "bg-cyan-600/20 text-cyan-200 shadow-sm"
                      : "text-white/40 hover:text-white/65 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={isActive ? "text-cyan-300/80" : "text-white/30"}>{subTab.icon}</span>
                    <span>{subTab.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
          {activeKind.label} template
        </p>
        <InfoTooltip text={activeKind.tooltip} side="bottom" />
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/50">
          {selectedKind === "weekdays"
            ? "Mon–Fri starter"
            : selectedKind === "saturday"
            ? "Saturday routine"
            : selectedKind === "sunday"
            ? "Sunday routine"
            : "Fallback starter"}
        </span>
      </div>

      <DayDataEditor
        data={data}
        onChange={(d) => setRoutineTemplate(selectedKind, d)}
        newIdFn={newIdFn}
        isTemplate
      />
    </div>
  );
}
