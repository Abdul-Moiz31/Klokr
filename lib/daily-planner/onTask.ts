import type { TabSession } from "@/lib/supabase";
import type { ManualAttribution, PlannerTask } from "./types";
import { normalizeDomainInput } from "@/lib/domain";

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
  return normalizeDomainInput(d);
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
 *
 * `/api/track` upserts one row per (user, domain, date) — repeat visits to
 * the same domain extend `end_time` forward without moving `start_time`, so
 * a domain visited both before and after a gap (e.g. during two separate
 * scheduled tasks) ends up as a single row whose [start_time, end_time]
 * wall-clock envelope spans both windows, even though real activity was
 * only a fraction of that span (`duration_seconds` is the true total).
 * Treating the full envelope as "active" would let two non-overlapping
 * tasks each separately claim the whole overlap — double-counting the same
 * real minutes. Instead we scale `duration_seconds` by the fraction of the
 * envelope that falls in this window, so the total attributed across every
 * task in the day can never exceed the session's true active time. This is
 * an approximation (it assumes activity is spread evenly across the
 * envelope) rather than exact per-visit truth, but it eliminates the
 * cross-task leak; only genuinely storing one row per visit would give
 * exact per-window attribution, at the cost of far more written rows.
 */
export function sessionMinutesInWindow(
  session: Pick<TabSession, "start_time" | "end_time" | "duration_seconds">,
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
  const overlapMinutes = hi > lo ? hi - lo : 0;
  if (overlapMinutes <= 0) return 0;

  const envelopeMinutes = end - start;
  const activeMinutes = Math.max(0, (session.duration_seconds ?? 0) / 60);
  // Never exceed the true active time, and never exceed the raw overlap
  // (defends against duration_seconds somehow outgrowing the envelope).
  return Math.min(overlapMinutes, activeMinutes * (overlapMinutes / envelopeMinutes));
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
  // Cap at the window length — overlapping sessions (multiple tabs in the same
  // window) must not push on-task time above the wall-clock window.
  onTaskMinutes = Math.min(onTaskMinutes, totalWindowMinutes);

  const percent = (onTaskMinutes / totalWindowMinutes) * 100;
  let status: OnTaskStatus;
  if (onTaskMinutes === 0) status = "no-activity";
  else if (percent < thresholdPercent) status = "below";
  else if (percent === thresholdPercent) status = "at-threshold";
  else status = "above";

  return { onTaskMinutes, totalWindowMinutes, percent, status };
}

/**
 * Day-level version of computeOnTaskStats(): correctly handles two scheduled
 * tasks with overlapping windows that tag the same domain.
 *
 * computeOnTaskStats() looks at one task in isolation, so sessionMinutesInWindow()
 * has no way to know a sibling task's window claims the same wall-clock minutes
 * — two overlapping tasks tagging "github.com" would each independently be
 * credited the full overlap, so the sum attributed across tasks could exceed
 * the domain's real tracked time for that stretch. This function computes
 * every scheduled task's claim on every session up front, and if a session's
 * combined claims from multiple tasks exceed what was actually tracked, scales
 * every claim down proportionally so the total across tasks can never exceed
 * the session's real active time. In the (overwhelmingly common) case of no
 * overlapping same-domain tasks, this produces identical numbers to calling
 * computeOnTaskStats() per task — the scale factor is 1.
 */
export function computeOnTaskStatsForDay(
  tasks: PlannerTask[],
  sessions: TabSession[],
  dayDate: Date,
  thresholdPercent: number
): Map<string, OnTaskStats> {
  const scheduled = tasks.filter((t) => t.startMinutes != null && t.endMinutes != null);

  const claimedMinutes = new Map<string, number>();
  for (const t of scheduled) claimedMinutes.set(t.id, 0);

  const taggedTasks = scheduled.filter((t) => t.domainTags.length > 0);
  for (const s of sessions) {
    const domain = normalizeDomain(s.domain);
    const claims: { taskId: string; minutes: number }[] = [];
    for (const t of taggedTasks) {
      if (!t.domainTags.some((d) => normalizeDomain(d) === domain)) continue;
      const m = sessionMinutesInWindow(s, dayDate, t.startMinutes as number, t.endMinutes as number);
      if (m > 0) claims.push({ taskId: t.id, minutes: m });
    }
    if (claims.length === 0) continue;

    const claimedTotal = claims.reduce((sum, c) => sum + c.minutes, 0);
    const activeMinutes = Math.max(0, (s.duration_seconds ?? 0) / 60);
    const scale = claimedTotal > activeMinutes && claimedTotal > 0 ? activeMinutes / claimedTotal : 1;
    for (const c of claims) {
      claimedMinutes.set(c.taskId, (claimedMinutes.get(c.taskId) ?? 0) + c.minutes * scale);
    }
  }

  const out = new Map<string, OnTaskStats>();
  for (const t of scheduled) {
    const totalWindowMinutes = (t.endMinutes as number) - (t.startMinutes as number);
    if (totalWindowMinutes <= 0) {
      out.set(t.id, ZERO_STATS);
      continue;
    }
    let onTaskMinutes = (claimedMinutes.get(t.id) ?? 0) + manualAttributionMinutes(t.manualAttributions);
    // Cap at the window length — overlapping sessions (multiple tabs in the
    // same window) must not push on-task time above the wall-clock window.
    onTaskMinutes = Math.min(onTaskMinutes, totalWindowMinutes);

    const percent = (onTaskMinutes / totalWindowMinutes) * 100;
    let status: OnTaskStatus;
    if (onTaskMinutes === 0) status = "no-activity";
    else if (percent < thresholdPercent) status = "below";
    else if (percent === thresholdPercent) status = "at-threshold";
    else status = "above";

    out.set(t.id, { onTaskMinutes, totalWindowMinutes, percent, status });
  }
  return out;
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
    // Overlapping sessions (multiple tabs/domains tracked in the same window)
    // would otherwise sum past the wall-clock length of the gap, producing
    // impossible totals like "216 min · 31h". Activity within a window can
    // never exceed the window itself — cap it.
    const windowMinutes = g.to - g.from;
    const cappedActivity = Math.min(activity, windowMinutes);
    const topDomains = [...byDomain.entries()]
      .map(([domain, minutes]) => ({ domain, minutes: Math.min(minutes, windowMinutes) }))
      .sort((a, b) => b.minutes - a.minutes);
    out.push({
      fromMinutes: g.from,
      toMinutes: g.to,
      activityMinutes: cappedActivity,
      topDomains,
    });
  }
  return out;
}
