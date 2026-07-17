import type { RecurringRule } from "./types";
import { dayKey } from "./date";

const DAY_MS = 24 * 60 * 60 * 1000;

// Pure calendar-day difference between two dates' Y/M/D components, immune
// to DST. Local midnight-to-midnight millisecond differences aren't
// reliably an exact multiple of 24h when a DST transition falls inside the
// range (a 23h or 25h day) — dividing by DAY_MS and flooring can silently
// round down to the wrong week, flipping a biweekly rule's parity for that
// week twice a year. Date.UTC() is never subject to DST, so treating each
// date's local Y/M/D as a UTC calendar-day number sidesteps the
// irregularity entirely — the result is always an exact integer.
function calendarDaysBetween(a: Date, b: Date): number {
  const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bUtc - aUtc) / DAY_MS);
}

/**
 * Whether this rule produces a task on the given calendar day (local).
 */
export function ruleAppliesOnDate(rule: RecurringRule, d: Date): boolean {
  const dow = d.getDay();
  const dom = d.getDate();

  switch (rule.frequency) {
    case "daily":
      return true;
    case "weekly": {
      if (rule.weekdays.length === 0) return false;
      return rule.weekdays.includes(dow);
    }
    case "biweekly": {
      if (rule.weekdays.length === 0) return false;
      if (!rule.weekdays.includes(dow)) return false;
      const anchor = new Date(rule.biweeklyAnchor + "T12:00:00");
      if (Number.isNaN(anchor.getTime())) return false;
      const diffDays = calendarDaysBetween(anchor, d);
      if (diffDays < 0) return false;
      const weekIndex = Math.floor(diffDays / 7);
      return weekIndex % 2 === 0;
    }
    case "monthly": {
      if (rule.monthDays.length === 0) return false;
      return rule.monthDays.includes(dom);
    }
    default:
      return false;
  }
}

export function completionKey(ruleId: string, d: Date) {
  return `${ruleId}:${dayKey(d)}`;
}

export function isRecurringDone(
  state: { recurringCompletions: Record<string, boolean> },
  ruleId: string,
  d: Date
) {
  return state.recurringCompletions[completionKey(ruleId, d)] === true;
}

/** Rules that fire on `d`, in display order (by `order`). */
export function rulesForDate(rules: RecurringRule[], d: Date) {
  const active = rules.filter((r) => ruleAppliesOnDate(r, d));
  return [...active].sort((a, b) => a.order - b.order);
}
