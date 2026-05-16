export type PlannerGroup = {
  id: string;
  title: string;
  order: number;
};

export type PlannerTask = {
  id: string;
  groupId: string;
  title: string;
  urgent: boolean;
  /** Todo completion — saved with the rest of the plan */
  done: boolean;
  /** minutes; null = no estimate */
  estimateMinutes: number | null;
  /** e.g. github.com — matched without www */
  domainTags: string[];
  order: number;
  /**
   * Minutes since local midnight [0, 1440). null = unscheduled (lives in the
   * unscheduled rail, not on the timeline). Snapped to 15-min increments on write.
   */
  startMinutes: number | null;
  /**
   * Exclusive end in minutes since local midnight (1, 1440]. null = unscheduled.
   * Always > startMinutes when both are set.
   */
  endMinutes: number | null;
};

export type DayData = {
  groups: PlannerGroup[];
  tasks: PlannerTask[];
};

export type TemplateKey = "weekday" | "saturday" | "sunday";

/** v1 (legacy) — migrated on load to v2 */
export type DailyPlannerV1 = {
  v: 1;
  routineTemplates: Record<TemplateKey, DayData>;
  dayOverrides: Record<string, DayData | undefined>;
  taskDump: DayData;
};

export type RecurrenceFrequency = "daily" | "weekly" | "biweekly" | "monthly";

/** Single stored rule — materialized into days via recurrence.ts */
export type RecurringRule = {
  id: string;
  title: string;
  urgent: boolean;
  estimateMinutes: number | null;
  domainTags: string[];
  frequency: RecurrenceFrequency;
  /** 0=Sun .. 6=Sat — for weekly and biweekly */
  weekdays: number[];
  /** 1–31 — for monthly */
  monthDays: number[];
  /** First occurrence anchor (yyyy-mm-dd) for bi-weekly parity; defaults at create */
  biweeklyAnchor: string;
  order: number;
  /**
   * Optional default schedule. When BOTH are set, the rule materializes onto a
   * day with those times; otherwise the task lands unscheduled.
   * Minutes since local midnight, snapped to 15.
   */
  defaultStartMinutes: number | null;
  defaultDurationMinutes: number | null;
};

/** Saved ad-hoc-style task groups used as “start from this” for a class of days */
export type RoutineTemplateKind = "fallback" | "weekdays" | "saturday" | "sunday";

/**
 * v2: recurring rules + ad-hoc per calendar day + task dump.
 * Optional named templates (edit under Routine templates) to copy into a given day.
 */
export type DailyPlannerV2 = {
  v: 2;
  recurringRules: RecurringRule[];
  /** yyyy-mm-dd -> ad-hoc groups/tasks (not from recurrence) */
  adHocByDate: Record<string, DayData | undefined>;
  taskDump: DayData;
  /** `${ruleId}:${yyyy-mm-dd}` -> done for that calendar day */
  recurringCompletions: Record<string, boolean>;
  /**
   * Fallback = generic starter; weekdays = Mon–Fri; saturday / sunday = each day separately.
   * Applying copies a deep clone with fresh group/task ids into ad-hoc for that day.
   */
  routineTemplates: Record<RoutineTemplateKind, DayData>;
};

/**
 * v3: same shape as v2 but tasks carry optional startMinutes/endMinutes and
 * recurring rules carry optional default schedule. Migration leaves all existing
 * tasks unscheduled (startMinutes/endMinutes = null), so nothing visible breaks.
 */
export type DailyPlannerV3 = Omit<DailyPlannerV2, "v"> & { v: 3 };

export type DailyPlannerState = DailyPlannerV3;

export type PlannerTaskRule = {
  taskId: string;
  domains: string[];
};
