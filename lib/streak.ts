/**
 * Shared streak + productive-day helpers. Single source of truth used by both
 * the Activity page and the dashboard streak widget so the numbers always match.
 */

export function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Consecutive days (ending today) that have any tracked time.
 * If today has no data yet, counts from yesterday so the streak doesn't reset
 * at midnight before the user has had a chance to browse.
 */
export function calcStreak(dailyMap: Map<string, number>, todayStr: string): number {
  let streak = 0;
  const cursor = new Date(todayStr + "T00:00:00");
  if ((dailyMap.get(todayStr) ?? 0) === 0) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const key = localDateStr(cursor);
    if ((dailyMap.get(key) ?? 0) > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/** Count of days whose tracked seconds met or exceeded the productive threshold. */
export function countProductiveDays(
  dailyMap: Map<string, number>,
  thresholdSeconds: number
): number {
  let count = 0;
  for (const seconds of dailyMap.values()) {
    if (seconds >= thresholdSeconds) count++;
  }
  return count;
}

export type ForgivingStreak = {
  /** Streak length (active days within the forgiving run). */
  count: number;
  /** True if a grace day is currently in play (a recent single miss was forgiven). */
  graceUsed: boolean;
  /** True if missing today would break the streak (yesterday was already a miss). */
  atRisk: boolean;
};

/**
 * Forgiving streak: a SINGLE missed day does not break the streak — only TWO
 * consecutive missed days do. This is the anti-abandonment design: one off day
 * shouldn't reset weeks of consistency, but you still can't skip indefinitely.
 *
 * Walks backward from today (or yesterday if today has no data yet), counting
 * active days. A lone gap is "forgiven" and walking continues; two gaps in a
 * row stop it.
 */
export function calcForgivingStreak(
  dailyMap: Map<string, number>,
  todayStr: string
): ForgivingStreak {
  const active = (d: Date) => (dailyMap.get(localDateStr(d)) ?? 0) > 0;

  const cursor = new Date(todayStr + "T00:00:00");
  const todayActive = active(cursor);
  // If today has no data yet, start from yesterday (don't penalize an in-progress day).
  if (!todayActive) cursor.setDate(cursor.getDate() - 1);

  let count = 0;
  let graceUsed = false;
  let prevWasGap = false;

  while (true) {
    if (active(cursor)) {
      count++;
      prevWasGap = false;
      cursor.setDate(cursor.getDate() - 1);
    } else if (!prevWasGap) {
      // First gap in a row — forgive it and keep going.
      graceUsed = true;
      prevWasGap = true;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break; // two gaps in a row — streak ends
    }
  }

  // At risk = today not yet active AND yesterday was a miss (one more breaks it).
  const yesterday = new Date(todayStr + "T00:00:00");
  yesterday.setDate(yesterday.getDate() - 1);
  const atRisk = !todayActive && !active(yesterday) && count > 0;

  return { count, graceUsed, atRisk };
}
