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
};

/** Saved ad-hoc-style task groups used as “start from this” for a class of days */
export type RoutineTemplateKind = "fallback" | "weekdays" | "weekend";

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
   * Fallback = generic starter; weekdays = Mon–Fri; weekend = Sat–Sun.
   * Applying copies a deep clone with fresh group/task ids into ad-hoc for that day.
   */
  routineTemplates: Record<RoutineTemplateKind, DayData>;
};

export type DailyPlannerState = DailyPlannerV2;

export type PlannerTaskRule = {
  taskId: string;
  domains: string[];
};
