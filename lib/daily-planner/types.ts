export type PlannerGroup = {
  id: string;
  title: string;
  order: number;
};

/**
 * Time range (minutes since local midnight) credited to a task via the red-block
 * "Background activity" modal. Stored on the task, separate from its scheduled
 * window, so the schedule stays honest while reports reflect reality.
 */
export type ManualAttribution = {
  fromMinutes: number;
  toMinutes: number;
  /** Minutes counted toward this task (sum of overlapping tab session durations). */
  addedMinutes: number;
  /** ms timestamp of when the attribution was made. */
  addedAt: number;
};

export type PlannerTask = {
  id: string;
  groupId: string;
  title: string;
  /** Free-form notes shown under the title in lists / modals. Optional, defaults to "". */
  description: string;
  /** Todo completion — saved with the rest of the plan */
  done: boolean;
  /** e.g. github.com — matched without www */
  domainTags: string[];
  order: number;
  /**
   * Minutes since local midnight [0, 1440). null = unscheduled (lives in the
   * unscheduled rail, not on the timeline). Snapped to 15-min increments on write.
   * Duration is derived from end − start; no separate estimate is stored.
   */
  startMinutes: number | null;
  /**
   * Exclusive end in minutes since local midnight (1, 1440]. null = unscheduled.
   * Always > startMinutes when both are set.
   */
  endMinutes: number | null;
  /** Set when on-task % crossed the threshold at end of the task's window. */
  autoCompleted?: boolean;
  /** ms timestamp when `done` last flipped true (manual or auto). */
  completedAt?: number;
  /** Red-block assignments — see ManualAttribution. */
  manualAttributions?: ManualAttribution[];
  /** ID of the template task this instance was cloned from (A1 lineage). */
  sourceTemplateTaskId?: string;
  /** Which template kind this lineage points into. */
  sourceTemplateKind?: RoutineTemplateKind;
  /**
   * Set true when user explicitly skipped a zero-activity scheduled task via the
   * offline-detection prompt — Phase 5. Distinct from `done` so reports can tell
   * "completed offline" from "skipped".
   */
  skipped?: boolean;
};

/**
 * Per-day "idle" time ranges — red blocks the user explicitly dismissed via the
 * Background-activity modal. Tracked separately so reports can show idle vs
 * unassigned vs attributed.
 */
export type IdleRange = {
  fromMinutes: number;
  toMinutes: number;
  /** ms timestamp the user marked this idle. */
  markedAt: number;
};

export type DayData = {
  groups: PlannerGroup[];
  tasks: PlannerTask[];
  /** Idle ranges for this day, populated via the Background-activity modal. */
  idleRanges?: IdleRange[];
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
  /** Free-form notes carried onto the materialized task. */
  description: string;
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
   * Optional default schedule. When BOTH are set, the rule materializes onto the
   * timeline (start/end minutes); otherwise the task lands in the Unscheduled rail.
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
 * recurring rules carry optional default schedule. Pre-v4 shape — `urgent` and
 * `estimateMinutes` still on tasks/rules.
 */
export type DailyPlannerV3 = Omit<DailyPlannerV2, "v"> & { v: 3 };

/**
 * v4: drops `urgent` and `estimateMinutes` from tasks and rules; adds
 * `description: string` to tasks and rules. Duration is derived from
 * end − start at the task level. Migration discards urgent/estimate values
 * and seeds description = "".
 */
export type DailyPlannerV4 = {
  v: 4;
  recurringRules: RecurringRule[];
  adHocByDate: Record<string, DayData | undefined>;
  taskDump: DayData;
  recurringCompletions: Record<string, boolean>;
  routineTemplates: Record<RoutineTemplateKind, DayData>;
};

/**
 * v5: extends v4 tasks with auto-completion fields (autoCompleted, completedAt),
 * red-block manual attributions, template lineage (sourceTemplateTaskId +
 * sourceTemplateKind), and skipped flag. DayData gains optional idleRanges.
 * No structural shape changes — migration is purely additive.
 */
export type DailyPlannerV5 = {
  v: 5;
  recurringRules: RecurringRule[];
  adHocByDate: Record<string, DayData | undefined>;
  taskDump: DayData;
  recurringCompletions: Record<string, boolean>;
  routineTemplates: Record<RoutineTemplateKind, DayData>;
};

export type DailyPlannerState = DailyPlannerV5;

export type PlannerTaskRule = {
  taskId: string;
  domains: string[];
};
