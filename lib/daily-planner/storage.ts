import type {
  DailyPlannerV1,
  DailyPlannerV2,
  DailyPlannerV3,
  DayData,
  PlannerTask,
  RecurringRule,
  RoutineTemplateKind,
} from "./types";
import { dayKey } from "./date";
export { dayKey } from "./date";
export { ruleAppliesOnDate, rulesForDate, completionKey, isRecurringDone } from "./recurrence";

const STORAGE_KEY = "Klokrs_daily_planner_v1";

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyGroup(title: string, order: number) {
  return { id: newId(), title, order };
}

export function createEmptyDayData(): DayData {
  return {
    groups: [emptyGroup("My tasks", 0)],
    tasks: [],
  };
}

/**
 * Copy a plan with new group/task ids so the same template can be applied
 * to several days (or combined) without id collisions in storage.
 */
export function dayDataWithFreshIds(d: DayData): DayData {
  const gMap = new Map<string, string>();
  for (const g of d.groups) {
    gMap.set(g.id, newId());
  }
  const groups = d.groups.map((g) => ({ ...g, id: gMap.get(g.id)! }));
  const tasks = d.tasks.map((t) => {
    const gid = gMap.get(t.groupId);
    return {
      ...t,
      id: newId(),
      groupId: gid ?? t.groupId,
    };
  });
  return { groups, tasks };
}

/**
 * Appends a task cloned from a recurring rule into the first group (by order).
 * Tab tracking follows ad-hoc/template tasks only, not the rule list itself.
 */
export function appendRecurringRuleAsTaskToDayData(
  dayData: DayData,
  rule: Pick<
    RecurringRule,
    | "title"
    | "urgent"
    | "estimateMinutes"
    | "domainTags"
    | "defaultStartMinutes"
    | "defaultDurationMinutes"
  >,
  newIdFn: () => string
): DayData {
  let groups = dayData.groups;
  const tasks = dayData.tasks;
  if (groups.length === 0) {
    const empty = createEmptyDayData();
    groups = empty.groups;
  }
  const sorted = [...groups].sort((a, b) => a.order - b.order);
  const dailyRoutine = sorted.find((g) => /daily\s+routine/i.test(g.title.trim()));
  const target = dailyRoutine ?? sorted[0];
  const tasksInG = tasks.filter((t) => t.groupId === target.id);
  const maxOrder = tasksInG.reduce((m, t) => Math.max(m, t.order), -1);
  const domainTags = (rule.domainTags ?? [])
    .map((d) => d.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
  let startMinutes: number | null = null;
  let endMinutes: number | null = null;
  if (
    isFiniteSchedule(rule.defaultStartMinutes) &&
    isFiniteSchedule(rule.defaultDurationMinutes)
  ) {
    const s = clampMinutes(rule.defaultStartMinutes!);
    const dur = Math.max(15, Math.round(rule.defaultDurationMinutes!));
    startMinutes = s;
    endMinutes = Math.min(1440, s + dur);
  }
  const newTask: PlannerTask = {
    id: newIdFn(),
    groupId: target.id,
    title: rule.title,
    urgent: rule.urgent,
    done: false,
    estimateMinutes: rule.estimateMinutes,
    domainTags,
    order: maxOrder + 1,
    startMinutes,
    endMinutes,
  };
  return { groups, tasks: [...tasks, newTask] };
}


function defaultRoutineTemplates(
  v1ForMigration?: DailyPlannerV1
): Record<RoutineTemplateKind, DayData> {
  if (v1ForMigration) {
    const t = v1ForMigration.routineTemplates;
    const d = (x: DayData) => migrateDayData(x);
    return {
      fallback: createEmptyDayData(),
      weekdays: d(t.weekday),
      saturday: d(t.saturday),
      sunday: d(t.sunday),
    };
  }
  return {
    fallback: createEmptyDayData(),
    weekdays: createEmptyDayData(),
    saturday: createEmptyDayData(),
    sunday: createEmptyDayData(),
  };
}

const DEFAULT_DUMP: DayData = {
  groups: [
    emptyGroup("Meetings", 0),
    emptyGroup("Book reading", 1),
    emptyGroup("Old / stopped", 2),
  ],
  tasks: [],
};

function migrateTask(t: PlannerTask): PlannerTask {
  const rawStart = isFiniteSchedule(t.startMinutes) ? clampMinutes(t.startMinutes!) : null;
  const rawEnd = isFiniteSchedule(t.endMinutes) ? clampMinutes(t.endMinutes!) : null;
  let startMinutes: number | null = rawStart;
  let endMinutes: number | null = rawEnd;
  if (startMinutes == null || endMinutes == null) {
    // If only one side is set, treat as unscheduled.
    startMinutes = null;
    endMinutes = null;
  } else if (endMinutes <= startMinutes) {
    // Enforce min 15-min duration on bad data.
    endMinutes = Math.min(1440, startMinutes + 15);
  }
  return {
    ...t,
    done: t.done === true,
    domainTags: Array.isArray(t.domainTags) ? t.domainTags : [],
    startMinutes,
    endMinutes,
  };
}

function isFiniteSchedule(n: number | null | undefined): boolean {
  return typeof n === "number" && Number.isFinite(n);
}

function clampMinutes(n: number): number {
  if (n < 0) return 0;
  if (n > 1440) return 1440;
  return Math.round(n);
}

function migrateDayData(d: DayData): DayData {
  return { ...d, tasks: d.tasks.map(migrateTask) };
}

function defaultV3(): DailyPlannerV3 {
  return {
    v: 3,
    recurringRules: [],
    adHocByDate: {},
    taskDump: JSON.parse(JSON.stringify(DEFAULT_DUMP)) as DayData,
    recurringCompletions: {},
    routineTemplates: defaultRoutineTemplates(),
  };
}

function migrateV1ToV3(v1: DailyPlannerV1): DailyPlannerV3 {
  const d = (x: DayData) => migrateDayData(x);
  const adHoc: Record<string, DayData | undefined> = {};
  for (const [key, val] of Object.entries(v1.dayOverrides)) {
    if (val) adHoc[key] = d(val);
  }
  return {
    v: 3,
    recurringRules: [],
    adHocByDate: adHoc,
    taskDump: d(v1.taskDump),
    recurringCompletions: {},
    routineTemplates: defaultRoutineTemplates(v1),
  };
}

function migrateV2ToV3(v2: DailyPlannerV2): DailyPlannerV3 {
  // Tasks pick up startMinutes/endMinutes = null via migrateTask. Rules pick up
  // defaultStartMinutes/defaultDurationMinutes = null via normalizeV3.
  return normalizeV3({ ...v2, v: 3 } as unknown as DailyPlannerV3);
}

function normalizeV3(p: DailyPlannerV3): DailyPlannerV3 {
  const defRt = defaultRoutineTemplates();
  const rt = p.routineTemplates;
  return {
    v: 3,
    recurringRules: (p.recurringRules ?? []).map((r) => {
      const start = isFiniteSchedule(r.defaultStartMinutes)
        ? clampMinutes(r.defaultStartMinutes!)
        : null;
      const dur = isFiniteSchedule(r.defaultDurationMinutes)
        ? Math.max(15, Math.round(r.defaultDurationMinutes!))
        : null;
      return {
        ...r,
        weekdays: Array.isArray(r.weekdays) ? r.weekdays : [],
        monthDays: Array.isArray(r.monthDays) ? r.monthDays : [],
        biweeklyAnchor: r.biweeklyAnchor || dayKey(new Date()),
        domainTags: Array.isArray(r.domainTags) ? r.domainTags : [],
        defaultStartMinutes: start,
        defaultDurationMinutes: dur,
      };
    }),
    adHocByDate: Object.fromEntries(
      Object.entries(p.adHocByDate ?? {}).map(([k, v]) => [
        k,
        v ? migrateDayData(v) : v,
      ])
    ) as Record<string, DayData | undefined>,
    taskDump: migrateDayData(p.taskDump ?? defaultV3().taskDump),
    recurringCompletions: p.recurringCompletions ?? {},
    routineTemplates: {
      fallback: migrateDayData(rt?.fallback ?? defRt.fallback),
      weekdays: migrateDayData(rt?.weekdays ?? defRt.weekdays),
      // Migrate old single "weekend" key to both saturday and sunday
      saturday: migrateDayData(rt?.saturday ?? (rt as Record<string, DayData | undefined>)?.["weekend"] ?? defRt.saturday),
      sunday: migrateDayData(rt?.sunday ?? (rt as Record<string, DayData | undefined>)?.["weekend"] ?? defRt.sunday),
    },
  };
}

export function loadDailyPlanner(): DailyPlannerV3 {
  if (typeof window === "undefined") return defaultV3();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultV3();
    const p = JSON.parse(raw) as DailyPlannerV1 | DailyPlannerV2 | DailyPlannerV3;
    if (p.v === 1) {
      const v3 = migrateV1ToV3(p);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v3));
      } catch {
        /* ignore */
      }
      return v3;
    }
    if (p.v === 2) {
      const v3 = migrateV2ToV3(p);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v3));
      } catch {
        /* ignore */
      }
      return v3;
    }
    if (p.v === 3) {
      if (!p.taskDump?.groups?.length) p.taskDump = defaultV3().taskDump;
      return normalizeV3(p);
    }
    return defaultV3();
  } catch {
    return defaultV3();
  }
}

/**
 * Coerce any historical planner shape into v3. Used by the hook when adopting
 * remote data that may have been written by an older client.
 */
export function migrateAnyToV3(
  raw: DailyPlannerV1 | DailyPlannerV2 | DailyPlannerV3 | undefined | null
): DailyPlannerV3 {
  if (!raw) return defaultV3();
  if ((raw as DailyPlannerV1).v === 1) return migrateV1ToV3(raw as DailyPlannerV1);
  if ((raw as DailyPlannerV2).v === 2) return migrateV2ToV3(raw as DailyPlannerV2);
  if ((raw as DailyPlannerV3).v === 3) return normalizeV3(raw as DailyPlannerV3);
  return defaultV3();
}

export function saveDailyPlanner(state: DailyPlannerV3) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function sortGroups(g: DayData["groups"]) {
  return [...g].sort((a, b) => a.order - b.order);
}

function tasksInGroup(tasks: PlannerTask[], groupId: string) {
  return tasks
    .filter((t) => t.groupId === groupId)
    .sort((a, b) => a.order - b.order);
}

function pushGroupTasks(
  groups: DayData["groups"],
  tasks: PlannerTask[],
  order: { taskId: string; domains: string[] }[],
  checkDone: (t: PlannerTask) => boolean
) {
  const pushTask = (t: PlannerTask) => {
    if (!checkDone(t)) return;
    if (t.domainTags.length === 0) return;
    const domains = t.domainTags
      .map((d) => d.trim().toLowerCase().replace(/^www\./, ""))
      .filter(Boolean);
    if (domains.length === 0) return;
    order.push({ taskId: t.id, domains });
  };

  for (const g of sortGroups(groups)) {
    const ts = tasksInGroup(tasks, g.id);
    const withU = ts.filter((t) => t.urgent);
    const noU = ts.filter((t) => !t.urgent);
    for (const t of [...withU, ...noU]) pushTask(t);
  }
}

/**
 * Tab-time rules: planned tasks for that day → task dump.
 * Recurring-rule rows are a library only until added to a template or today.
 */
export function buildTabTrackingRules(
  state: DailyPlannerV3,
  forDate: Date
): { taskId: string; domains: string[] }[] {
  const order: { taskId: string; domains: string[] }[] = [];

  const k = dayKey(forDate);
  const adHoc = state.adHocByDate[k] ?? { groups: [], tasks: [] };

  // Scheduled tasks first, in time order — matches "the thing I'm doing now".
  const scheduled = adHoc.tasks
    .filter((t) => !t.done && t.startMinutes != null && t.domainTags.length > 0)
    .sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0));
  for (const t of scheduled) {
    const domains = t.domainTags
      .map((d) => d.trim().toLowerCase().replace(/^www\./, ""))
      .filter(Boolean);
    if (domains.length > 0) order.push({ taskId: t.id, domains });
  }

  // Unscheduled tasks within the day's plan, by group/order.
  const unscheduledDay: DayData = {
    groups: adHoc.groups,
    tasks: adHoc.tasks.filter((t) => t.startMinutes == null),
  };
  pushGroupTasks(unscheduledDay.groups, unscheduledDay.tasks, order, (t) => !t.done);

  // Task dump as final fallback.
  pushGroupTasks(
    state.taskDump.groups,
    state.taskDump.tasks,
    order,
    (t) => !t.done
  );

  return order;
}

export { newId };
