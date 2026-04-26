import type { RecurringRule } from "./types";
import { dayKey } from "./date";

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

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
      const a0 = startOfLocalDay(anchor);
      const b0 = startOfLocalDay(d);
      const diffDays = Math.floor(
        (b0.getTime() - a0.getTime()) / DAY_MS
      );
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

/** Rules that fire on `d`, in display order (urgent first, then `order`). */
export function rulesForDate(rules: RecurringRule[], d: Date) {
  const active = rules.filter((r) => ruleAppliesOnDate(r, d));
  return [...active].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return a.order - b.order;
  });
}
