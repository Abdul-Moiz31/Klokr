import type { TabSession } from "@/lib/supabase";
import type { ManualAttribution, PlannerTask } from "./types";

/**
 * Pure on-task computation for planner tasks. No React, no IO — these helpers
 * take a task plus today's tab_sessions and return how much of the task's
 * scheduled window was spent on its tagged domains.
 *
 * Status thresholds for the fill bar:
 *   "no-activity"   onTaskMinutes === 0
 *   "below"         0 < percent < threshold
 *   "at-threshold"  percent === threshold (rare, but distinct)
 *   "above"         percent > threshold (also fires the corner check icon at >= 100)
 */
export type OnTaskStatus = "no-activity" | "below" | "at-threshold" | "above";

export type OnTaskStats = {
  onTaskMinutes: number;
  totalWindowMinutes: number;
  /** 0..100+ — capped at the call site if needed for UI. */
  percent: number;
  status: OnTaskStatus;
};

const ZERO_STATS: OnTaskStats = {
  onTaskMinutes: 0,
  totalWindowMinutes: 0,
  percent: 0,
  status: "no-activity",
};

function normalizeDomain(d: string): string {
  return d.trim().toLowerCase().replace(/^www\./, "");
}

/**
 * Convert an ISO timestamp into "minutes since local midnight on `dayDate`".
 * Returns null if the timestamp doesn't fall on `dayDate` in the local zone.
 */
function isoToLocalDayMinutes(iso: string, dayDate: Date): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (
    d.getFullYear() !== dayDate.getFullYear() ||
    d.getMonth() !== dayDate.getMonth() ||
    d.getDate() !== dayDate.getDate()
  ) {
    return null;
  }
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Minutes of `session` that overlap [fromMinutes, toMinutes) on `dayDate`.
 * Sessions that span midnight are truncated to the day under inspection.
 */
export function sessionMinutesInWindow(
  session: Pick<TabSession, "start_time" | "end_time">,
  dayDate: Date,
  fromMinutes: number,
  toMinutes: number
): number {
  if (toMinutes <= fromMinutes) return 0;
  const startInDay = isoToLocalDayMinutes(session.start_time, dayDate);
  const endInDay = isoToLocalDayMinutes(session.end_time, dayDate);
  // Truncate to [0, 1440) when one end is on a neighbouring day.
  const start = startInDay ?? 0;
  const end = endInDay ?? 1440;
  if (end <= start) return 0;
  const lo = Math.max(start, fromMinutes);
  const hi = Math.min(end, toMinutes);
  return hi > lo ? hi - lo : 0;
}

/** Sum the manualAttributions minutes that overlap the task's window. */
function manualAttributionMinutes(attrs: ManualAttribution[] | undefined): number {
  if (!attrs || attrs.length === 0) return 0;
  let total = 0;
  for (const a of attrs) total += Math.max(0, a.addedMinutes);
  return total;
}

/**
 * Compute on-task stats for a single scheduled task on `dayDate`. Unscheduled
 * tasks (startMinutes == null or endMinutes == null) return zeroed stats.
 *
 * On-task minutes = (a) duration of any tab session in the task window whose
 * domain matches a tagged domain, plus (b) any manualAttribution minutes the
 * user assigned via the red-block modal (Phase 3).
 */
export function computeOnTaskStats(
  task: PlannerTask,
  sessions: TabSession[],
  dayDate: Date,
  thresholdPercent: number
): OnTaskStats {
  if (task.startMinutes == null || task.endMinutes == null) return ZERO_STATS;
  const fromMin = task.startMinutes;
  const toMin = task.endMinutes;
  const totalWindowMinutes = toMin - fromMin;
  if (totalWindowMinutes <= 0) return ZERO_STATS;

  const taggedSet = new Set(task.domainTags.map(normalizeDomain));
  let onTaskMinutes = 0;
  if (taggedSet.size > 0) {
    for (const s of sessions) {
      if (!taggedSet.has(normalizeDomain(s.domain))) continue;
      onTaskMinutes += sessionMinutesInWindow(s, dayDate, fromMin, toMin);
    }
  }
  onTaskMinutes += manualAttributionMinutes(task.manualAttributions);

  const percent = (onTaskMinutes / totalWindowMinutes) * 100;
  let status: OnTaskStatus;
  if (onTaskMinutes === 0) status = "no-activity";
  else if (percent < thresholdPercent) status = "below";
  else if (percent === thresholdPercent) status = "at-threshold";
  else status = "above";

  return { onTaskMinutes, totalWindowMinutes, percent, status };
}

export type UnscheduledGap = {
  fromMinutes: number;
  toMinutes: number;
  /** Total minutes of tab activity inside the gap (across all domains). */
  activityMinutes: number;
  /** Top domains in the gap, ordered by minutes desc. */
  topDomains: { domain: string; minutes: number }[];
};

/**
 * Return contiguous unscheduled windows on `dayDate` of at least `minGapMinutes`
 * that contain any tab activity. "Unscheduled" = not covered by any scheduled
 * task in `tasks`. Past day-end is bounded by the latest session end time
 * (capped at 1440); pre day-start is from 0.
 *
 * Used by the Phase 3 red-block renderer.
 */
export function findUnscheduledGaps(
  tasks: PlannerTask[],
  sessions: TabSession[],
  dayDate: Date,
  minGapMinutes: number
): UnscheduledGap[] {
  if (minGapMinutes <= 0) return [];

  // Build a sorted list of task occupied ranges.
  const occupied = tasks
    .filter((t) => t.startMinutes != null && t.endMinutes != null)
    .map((t) => ({ from: t.startMinutes as number, to: t.endMinutes as number }))
    .sort((a, b) => a.from - b.from);

  // Merge overlapping/touching ranges.
  const merged: { from: number; to: number }[] = [];
  for (const r of occupied) {
    const last = merged[merged.length - 1];
    if (last && r.from <= last.to) last.to = Math.max(last.to, r.to);
    else merged.push({ ...r });
  }

  // Determine the day's active span — from the earliest session start to the
  // latest session end (clamped to [0, 1440]). If no sessions, no gaps.
  let firstActivity = 1440;
  let lastActivity = 0;
  for (const s of sessions) {
    const sMin = isoToLocalDayMinutes(s.start_time, dayDate) ?? 0;
    const eMin = isoToLocalDayMinutes(s.end_time, dayDate) ?? 1440;
    if (sMin < firstActivity) firstActivity = sMin;
    if (eMin > lastActivity) lastActivity = eMin;
  }
  if (sessions.length === 0 || lastActivity <= firstActivity) return [];

  // Walk the day from firstActivity → lastActivity, emit gaps between
  // occupied ranges that intersect this span.
  const gaps: { from: number; to: number }[] = [];
  let cursor = firstActivity;
  for (const r of merged) {
    if (r.to <= cursor) continue;
    if (r.from > cursor) {
      const to = Math.min(r.from, lastActivity);
      if (to > cursor) gaps.push({ from: cursor, to });
    }
    cursor = Math.max(cursor, r.to);
    if (cursor >= lastActivity) break;
  }
  if (cursor < lastActivity) gaps.push({ from: cursor, to: lastActivity });

  // Filter by minimum gap, attach domain breakdown.
  const out: UnscheduledGap[] = [];
  for (const g of gaps) {
    if (g.to - g.from < minGapMinutes) continue;
    const byDomain = new Map<string, number>();
    let activity = 0;
    for (const s of sessions) {
      const m = sessionMinutesInWindow(s, dayDate, g.from, g.to);
      if (m <= 0) continue;
      activity += m;
      const dom = normalizeDomain(s.domain);
      byDomain.set(dom, (byDomain.get(dom) ?? 0) + m);
    }
    if (activity <= 0) continue;
    const topDomains = [...byDomain.entries()]
      .map(([domain, minutes]) => ({ domain, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
    out.push({
      fromMinutes: g.from,
      toMinutes: g.to,
      activityMinutes: activity,
      topDomains,
    });
  }
  return out;
}
