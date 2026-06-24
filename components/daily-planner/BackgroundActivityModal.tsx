"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { UnscheduledGap } from "@/lib/daily-planner/onTask";
import type { PlannerTask } from "@/lib/daily-planner/types";
import { formatRange } from "@/lib/daily-planner/timeline";

type Props = {
  gap: UnscheduledGap;
  /** Today's scheduled tasks the user can assign this gap to. */
  scheduledTasks: PlannerTask[];
  /** Pick a task → credit the gap's domain minutes to it. */
  onAssignToTask: (taskId: string) => void;
  /** Mark the gap as idle for this day; it disappears from red blocks. */
  onMarkIdle: () => void;
  /** Open the create-task modal pre-filled with the gap's range + top domain. */
  onCopyAsTask: () => void;
  onClose: () => void;
};

function fmtMinutes(min: number): string {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function BackgroundActivityModal({
  gap,
  scheduledTasks,
  onAssignToTask,
  onMarkIdle,
  onCopyAsTask,
  onClose,
}: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    scheduledTasks[0]?.id ?? ""
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const gapDuration = gap.toMinutes - gap.fromMinutes;
  const activePercent = useMemo(() => {
    if (gapDuration <= 0) return 0;
    return Math.min(100, Math.round((gap.activityMinutes / gapDuration) * 100));
  }, [gap.activityMinutes, gapDuration]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#0f0f16] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">Background activity</h3>
            <p className="mt-1 text-xs text-white/45">
              Unscheduled tab time — assign it or mark it idle.
            </p>
          </div>
          <button
            type="button"
            onClick={onCopyAsTask}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.04] hover:text-white/90"
          >
            Copy as task
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Timeframe</p>
            <p className="mt-1 text-sm text-white/90 tabular-nums">
              {formatRange(gap.fromMinutes, gap.toMinutes)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Total time</p>
            <p className="mt-1 text-sm text-white/90 tabular-nums">
              {fmtMinutes(gap.activityMinutes)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Active time</p>
            <p className="mt-1 text-sm text-white/90 tabular-nums">{activePercent}%</p>
          </div>
        </div>

        <div className="mb-5 max-h-48 overflow-y-auto rounded-xl border border-white/[0.06]">
          {gap.topDomains.map(({ domain, minutes }) => {
            const pct =
              gap.activityMinutes > 0
                ? Math.round((minutes / gap.activityMinutes) * 100)
                : 0;
            return (
              <div
                key={domain}
                className="flex items-center justify-between border-b border-white/[0.04] px-3 py-2 last:border-b-0"
              >
                <span className="truncate text-sm text-white/80">{domain}</span>
                <span className="ml-3 shrink-0 text-xs text-white/55 tabular-nums">
                  {fmtMinutes(minutes)} · {pct}%
                </span>
              </div>
            );
          })}
          {gap.topDomains.length === 0 && (
            <p className="px-3 py-3 text-sm text-white/40">No tracked activity.</p>
          )}
        </div>

        <div className="mb-3">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Assign to task
          </label>
          {scheduledTasks.length === 0 ? (
            <p className="mt-2 text-sm text-white/40">
              No scheduled tasks today. Use “Copy as task” to capture this time.
            </p>
          ) : (
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus:border-violet-500/40 focus:outline-none"
            >
              {scheduledTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || "(untitled)"} ·{" "}
                  {formatRange(t.startMinutes ?? 0, t.endMinutes ?? 0)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {scheduledTasks.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (selectedTaskId) onAssignToTask(selectedTaskId);
              }}
              disabled={!selectedTaskId}
              className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Assign to selected task
            </button>
          )}
          <button
            type="button"
            onClick={onMarkIdle}
            className="w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.04] hover:text-white/90"
          >
            Skip — mark as idle
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 text-xs text-white/40 transition hover:text-white/65"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
