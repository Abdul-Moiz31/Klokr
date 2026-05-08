import type {
  DailyPlannerV1,
  DailyPlannerV2,
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
  rule: Pick<RecurringRule, "title" | "urgent" | "estimateMinutes" | "domainTags">,
  newIdFn: () => string
): DayData {
  let groups = dayData.groups;
  let tasks = dayData.tasks;
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
  const newTask: PlannerTask = {
    id: newIdFn(),
    groupId: target.id,
    title: rule.title,
    urgent: rule.urgent,
    done: false,
    estimateMinutes: rule.estimateMinutes,
    domainTags,
    order: maxOrder + 1,
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
  return {
    ...t,
    done: t.done === true,
    domainTags: Array.isArray(t.domainTags) ? t.domainTags : [],
  };
}

function migrateDayData(d: DayData): DayData {
  return { ...d, tasks: d.tasks.map(migrateTask) };
}

function defaultV2(): DailyPlannerV2 {
  return {
    v: 2,
    recurringRules: [],
    adHocByDate: {},
    taskDump: JSON.parse(JSON.stringify(DEFAULT_DUMP)) as DayData,
    recurringCompletions: {},
    routineTemplates: defaultRoutineTemplates(),
  };
}

function migrateV1ToV2(v1: DailyPlannerV1): DailyPlannerV2 {
  const d = (x: DayData) => migrateDayData(x);
  const adHoc: Record<string, DayData | undefined> = {};
  for (const [key, val] of Object.entries(v1.dayOverrides)) {
    if (val) adHoc[key] = d(val);
  }
  return {
    v: 2,
    recurringRules: [],
    adHocByDate: adHoc,
    taskDump: d(v1.taskDump),
    recurringCompletions: {},
    routineTemplates: defaultRoutineTemplates(v1),
  };
}

function normalizeV2(p: DailyPlannerV2): DailyPlannerV2 {
  const defRt = defaultRoutineTemplates();
  const rt = p.routineTemplates;
  return {
    v: 2,
    recurringRules: (p.recurringRules ?? []).map((r) => ({
      ...r,
      weekdays: Array.isArray(r.weekdays) ? r.weekdays : [],
      monthDays: Array.isArray(r.monthDays) ? r.monthDays : [],
      biweeklyAnchor: r.biweeklyAnchor || dayKey(new Date()),
      domainTags: Array.isArray(r.domainTags) ? r.domainTags : [],
    })),
    adHocByDate: Object.fromEntries(
      Object.entries(p.adHocByDate ?? {}).map(([k, v]) => [
        k,
        v ? migrateDayData(v) : v,
      ])
    ) as Record<string, DayData | undefined>,
    taskDump: migrateDayData(p.taskDump ?? defaultV2().taskDump),
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

export function loadDailyPlanner(): DailyPlannerV2 {
  if (typeof window === "undefined") return defaultV2();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultV2();
    const p = JSON.parse(raw) as DailyPlannerV1 | DailyPlannerV2;
    if (p.v === 1) {
      const v2 = migrateV1ToV2(p);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v2));
      } catch {
        /* ignore */
      }
      return v2;
    }
    if (p.v === 2) {
      if (!p.taskDump?.groups?.length) p.taskDump = defaultV2().taskDump;
      return normalizeV2(p as DailyPlannerV2);
    }
    return defaultV2();
  } catch {
    return defaultV2();
  }
}

export function saveDailyPlanner(state: DailyPlannerV2) {
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
  state: DailyPlannerV2,
  forDate: Date
): { taskId: string; domains: string[] }[] {
  const order: { taskId: string; domains: string[] }[] = [];

  const k = dayKey(forDate);
  const adHoc = state.adHocByDate[k] ?? { groups: [], tasks: [] };
  pushGroupTasks(adHoc.groups, adHoc.tasks, order, (t) => !t.done);
  pushGroupTasks(
    state.taskDump.groups,
    state.taskDump.tasks,
    order,
    (t) => !t.done
  );

  return order;
}

export { newId };
