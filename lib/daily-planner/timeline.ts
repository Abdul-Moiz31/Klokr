/**
 * Pure helpers for converting between PlannerTask minute fields and the
 * Date instances that FullCalendar uses, plus snap rules.
 */

export const SNAP_MINUTES = 15;
export const MIN_DURATION_MINUTES = 15;

/** Snap minutes-since-midnight to the SNAP_MINUTES grid; clamps to [0, 1440]. */
export function snapMinutes(n: number): number {
  const clamped = Math.max(0, Math.min(1440, n));
  return Math.round(clamped / SNAP_MINUTES) * SNAP_MINUTES;
}

/** Local-time start of the given calendar day (00:00 local). */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Construct a Date at (startOfLocalDay(forDate) + minutes). Caps the end of
 * day at 23:59 local since FullCalendar's day cell ends at midnight.
 */
export function minutesToDate(forDate: Date, minutes: number): Date {
  const m = Math.max(0, Math.min(1440, minutes));
  const base = startOfLocalDay(forDate);
  if (m === 1440) {
    // 24:00 isn't a valid time; FullCalendar wants 23:59 for "end of day".
    base.setHours(23, 59, 0, 0);
    return base;
  }
  base.setHours(0, m, 0, 0);
  return base;
}

/** Minutes-since-midnight (local) for a Date. */
export function dateToMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Coerce a start/end pair into a valid, snapped, in-bounds range.
 * Guarantees end > start by at least MIN_DURATION_MINUTES.
 */
export function normalizeRange(
  startMinutes: number,
  endMinutes: number
): { start: number; end: number } {
  let start = snapMinutes(startMinutes);
  let end = snapMinutes(endMinutes);
  if (end <= start) end = Math.min(1440, start + MIN_DURATION_MINUTES);
  if (start >= 1440 - MIN_DURATION_MINUTES) {
    start = 1440 - MIN_DURATION_MINUTES;
    end = 1440;
  }
  return { start, end };
}

/** Human label for a minute-of-day, e.g. 540 -> "09:00". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.min(1440, Math.round(minutes)));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "09:00 → 10:30 · 90 min" */
export function formatRange(startMinutes: number, endMinutes: number): string {
  const dur = Math.max(0, endMinutes - startMinutes);
  return `${formatMinutes(startMinutes)} → ${formatMinutes(endMinutes)} · ${dur} min`;
}
