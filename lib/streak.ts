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
