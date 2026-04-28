"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DayDataEditor } from "./DayDataEditor";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Loader } from "@/components/ui/Loader";
import { useDailyPlannerState } from "@/lib/daily-planner/useDailyPlannerState";
import type { RoutineTemplateKind } from "@/lib/daily-planner/types";
import { createEmptyDayData } from "@/lib/daily-planner/storage";

const KINDS: {
  id: RoutineTemplateKind;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "fallback",
    label: "Fallback",
    tooltip: "A generic starter you can copy to any day when the weekday or weekend preset doesn't fit.",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: "weekdays",
    label: "Weekdays",
    tooltip: "Suggested Mon–Fri in the daily planner. Edit groups and tasks here to fit your typical workday.",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    id: "saturday",
    label: "Saturday",
    tooltip: "Suggested every Saturday in the daily planner. Set up a different rhythm for your Saturday.",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 009 9 9 9 0 11-9-9z" />
      </svg>
    ),
  },
  {
    id: "sunday",
    label: "Sunday",
    tooltip: "Suggested every Sunday in the daily planner. Set up your rest day routine.",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
];

export function RoutineTemplatesEditor() {
  const { state, hydrated, setRoutineTemplate, newId: newIdFn } = useDailyPlannerState();
  const [tab, setTab] = useState<RoutineTemplateKind>("fallback");

  if (!hydrated || !state) {
    return <Loader />;
  }

  const data = state.routineTemplates[tab] ?? createEmptyDayData();
  const activeKind = KINDS.find((k) => k.id === tab)!;

  return (
    <div className="w-full max-w-4xl">
      {/* Tab bar */}
      <div className="mb-7 flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
        {KINDS.map((k) => {
          const isActive = tab === k.id;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setTab(k.id)}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-cyan-600/20 text-cyan-200 shadow-sm"
                  : "text-white/40 hover:text-white/65 hover:bg-white/[0.04]"
              }`}
            >
              <span className={isActive ? "text-cyan-300/80" : "text-white/30"}>
                {k.icon}
              </span>
              {k.label}
              {isActive && (
                <motion.div
                  layoutId="rt-tab-indicator"
                  className="absolute inset-0 rounded-xl border border-cyan-500/20"
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Section header with tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
        >
          <div className="mb-4 flex items-center gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {activeKind.label} template
            </p>
            <InfoTooltip text={activeKind.tooltip} side="bottom" />
          </div>

          <DayDataEditor
            data={data}
            onChange={(d) => setRoutineTemplate(tab, d)}
            newIdFn={newIdFn}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
