import type { TabSession } from "@/lib/supabase";
import type { PlannerTask } from "./types";
import { computeOnTaskStatsForDay } from "./onTask";

/** Below this, a domain-tracked task is classified "missed" at window end. */
export const PARTIAL_THRESHOLD = 50;

export type AutoCompleteApply = {
  taskId: string;
  /** ms timestamp to write into completedAt. Only meaningful when done === true. */
  completedAt: number;
  done: boolean;
  outcome: "done" | "partial" | "missed";
};

/**
 * Pure function: returns the final classification for every domain-tracked
 * scheduled task whose window just ended. Caller writes the updates — keeps
 * this module IO-free and trivially testable.
 *
 * Rules:
 *   - prefs.autoCompleteEnabled must be true
 *   - task must be scheduled (start & end set) and domain-tracked
 *     (domainTags.length > 0) — offline/manual tasks are handled separately,
 *     there's no reliable signal to auto-classify them from.
 *   - task.endMinutes must be in the past on `dayDate` — classification only
 *     happens once, at window end, never mid-window (percent can still drop
 *     back down before the window closes, so an early read isn't final).
 *   - task.outcome must be unset — once classified, a task is never
 *     re-evaluated again. This is also what makes a manual override (the user
 *     flips done/outcome by hand after the fact) stick permanently, with no
 *     separate "ignore" bookkeeping needed.
 *   - task.skipped must not be true (offline-detection prompt already resolved it)
 *
 *   percent >= autoCompleteThreshold        → done: true,  outcome: "done"
 *   PARTIAL_THRESHOLD <= percent < threshold → done: false, outcome: "partial"
 *   percent < PARTIAL_THRESHOLD (incl. 0)    → done: false, outcome: "missed"
 */
export function pickAutoCompletions(
  tasks: PlannerTask[],
  sessions: TabSession[],
  dayDate: Date,
  prefs: { autoCompleteEnabled: boolean; autoCompleteThreshold: number },
  nowMinutes: number
): AutoCompleteApply[] {
  if (!prefs.autoCompleteEnabled) return [];
  const completedAt = Date.now();
  const out: AutoCompleteApply[] = [];
  // Computed once for the whole day (not per task) so two overlapping tasks
  // tagging the same domain split their shared minutes fairly instead of
  // each independently claiming the full overlap — see computeOnTaskStatsForDay().
  const statsByTask = computeOnTaskStatsForDay(tasks, sessions, dayDate, prefs.autoCompleteThreshold);
  for (const t of tasks) {
    if (t.outcome != null) continue;
    if (t.done === true) continue;
    if (t.skipped === true) continue;
    if (t.domainTags.length === 0) continue;
    if (t.startMinutes == null || t.endMinutes == null) continue;
    if (t.endMinutes > nowMinutes) continue;
    const stats = statsByTask.get(t.id);
    if (!stats) continue;
    if (stats.percent >= prefs.autoCompleteThreshold) {
      out.push({ taskId: t.id, completedAt, done: true, outcome: "done" });
    } else if (stats.percent >= PARTIAL_THRESHOLD) {
      out.push({ taskId: t.id, completedAt, done: false, outcome: "partial" });
    } else {
      out.push({ taskId: t.id, completedAt, done: false, outcome: "missed" });
    }
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
