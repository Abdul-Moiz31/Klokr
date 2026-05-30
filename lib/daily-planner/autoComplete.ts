import type { TabSession } from "@/lib/supabase";
import type { PlannerTask } from "./types";
import { computeOnTaskStats } from "./onTask";

export type AutoCompleteApply = {
  taskId: string;
  /** ms timestamp to write into completedAt. */
  completedAt: number;
};

/**
 * Pure function: returns the list of task IDs that should auto-complete now.
 * Caller writes the updates (set done = true, autoCompleted = true,
 * completedAt) — keeps this module IO-free and trivially testable.
 *
 * Rules:
 *   - prefs.autoCompleteEnabled must be true
 *   - task must be scheduled (start & end set)
 *   - task.endMinutes must be in the past on `dayDate`
 *   - task.done must be false
 *   - task.autoCompleted must be false/undefined
 *   - task.skipped must not be true
 *   - on-task percent (incl. manual attributions) must be >= threshold
 *
 * `ignoredTaskIds` is a Set of task IDs the user manually un-completed this
 * session — we skip them so they don't flip right back to done.
 */
export function pickAutoCompletions(
  tasks: PlannerTask[],
  sessions: TabSession[],
  dayDate: Date,
  prefs: { autoCompleteEnabled: boolean; autoCompleteThreshold: number },
  nowMinutes: number,
  ignoredTaskIds: Set<string>
): AutoCompleteApply[] {
  if (!prefs.autoCompleteEnabled) return [];
  const completedAt = Date.now();
  const out: AutoCompleteApply[] = [];
  for (const t of tasks) {
    if (t.done === true) continue;
    if (t.autoCompleted === true) continue;
    if (t.skipped === true) continue;
    if (t.startMinutes == null || t.endMinutes == null) continue;
    if (t.endMinutes > nowMinutes) continue;
    if (ignoredTaskIds.has(t.id)) continue;
    const stats = computeOnTaskStats(t, sessions, dayDate, prefs.autoCompleteThreshold);
    if (stats.percent < prefs.autoCompleteThreshold) continue;
    out.push({ taskId: t.id, completedAt });
  }
  return out;
}

/**
 * Helper: minutes since local midnight for `at` (default now). Capped at 1440.
 */
export function localMinutesNow(at: Date = new Date()): number {
  return Math.min(
    1440,
    at.getHours() * 60 + at.getMinutes() + at.getSeconds() / 60
  );
}
