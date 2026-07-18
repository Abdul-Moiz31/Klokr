import type {
  DailyPlannerV1,
  DailyPlannerV2,
  DailyPlannerV3,
  DailyPlannerV4,
  DailyPlannerV5,
  DayData,
  IdleRange,
  ManualAttribution,
  PlannerTask,
  PlannerTaskRule,
  RecurringRule,
  RoutineTemplateKind,
} from "./types";
import { dayKey } from "./date";
import { normalizeDomainInput } from "@/lib/domain";
import { ruleAppliesOnDate } from "./recurrence";
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
 *
 * When `templateKind` is provided, each cloned task records lineage back to its
 * source template task via `sourceTemplateTaskId` + `sourceTemplateKind`. This
 * enables the A1 confirm dialog ("Apply to today only / Apply to template").
 *
 * Auto-completion state (`autoCompleted`, `completedAt`, `manualAttributions`,
 * `skipped`, `done`) is never copied from a template — instances always start
 * fresh.
 */
export function dayDataWithFreshIds(
  d: DayData,
  templateKind?: RoutineTemplateKind
): DayData {
  const gMap = new Map<string, string>();
  for (const g of d.groups) {
    gMap.set(g.id, newId());
  }
  const groups = d.groups.map((g) => ({ ...g, id: gMap.get(g.id)! }));
  const tasks = d.tasks.map((t) => {
    const gid = gMap.get(t.groupId);
    const lineage = templateKind
      ? { sourceTemplateTaskId: t.id, sourceTemplateKind: templateKind }
      : {};
    const fresh: PlannerTask = {
      ...t,
      id: newId(),
      groupId: gid ?? t.groupId,
      done: false,
      ...lineage,
    };
    // Instances never inherit completion/attribution state from a template.
    delete fresh.autoCompleted;
    delete fresh.completedAt;
    delete fresh.manualAttributions;
    delete fresh.skipped;
    delete fresh.outcome;
    return fresh;
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
    | "description"
    | "domainTags"
    | "blockedDomainTags"
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
  const domainTags = (rule.domainTags ?? []).map(normalizeDomainInput).filter(Boolean);
  const blockedDomainTags = (rule.blockedDomainTags ?? []).map(normalizeDomainInput).filter(Boolean);
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
    description: rule.description ?? "",
    done: false,
    domainTags,
    ...(blockedDomainTags.length > 0 ? { blockedDomainTags } : {}),
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

/**
 * Coerce an unknown-shape task (from any historical version) into the v4
 * PlannerTask shape. Discards `urgent` and `estimateMinutes` if present;
 * adds `description = ""` if missing.
 */
const VALID_TEMPLATE_KINDS: RoutineTemplateKind[] = [
  "fallback",
  "weekdays",
  "saturday",
  "sunday",
];

function migrateManualAttributions(raw: unknown): ManualAttribution[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ManualAttribution[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const from = typeof rec.fromMinutes === "number" ? clampMinutes(rec.fromMinutes) : null;
    const to = typeof rec.toMinutes === "number" ? clampMinutes(rec.toMinutes) : null;
    const added = typeof rec.addedMinutes === "number" ? Math.max(0, Math.round(rec.addedMinutes)) : null;
    const at = typeof rec.addedAt === "number" ? rec.addedAt : null;
    if (from == null || to == null || added == null || at == null || to <= from) continue;
    out.push({ fromMinutes: from, toMinutes: to, addedMinutes: added, addedAt: at });
  }
  return out.length ? out : undefined;
}

function migrateTask(raw: unknown): PlannerTask {
  const t = (raw ?? {}) as Record<string, unknown>;
  const rawStartNum = typeof t.startMinutes === "number" ? t.startMinutes : null;
  const rawEndNum = typeof t.endMinutes === "number" ? t.endMinutes : null;
  const rawStart = isFiniteSchedule(rawStartNum) ? clampMinutes(rawStartNum!) : null;
  const rawEnd = isFiniteSchedule(rawEndNum) ? clampMinutes(rawEndNum!) : null;
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
  const out: PlannerTask = {
    id: typeof t.id === "string" ? t.id : newId(),
    groupId: typeof t.groupId === "string" ? t.groupId : "",
    title: typeof t.title === "string" ? t.title : "",
    description: typeof t.description === "string" ? t.description : "",
    done: t.done === true,
    domainTags: Array.isArray(t.domainTags)
      ? (t.domainTags.filter((d) => typeof d === "string") as string[])
      : [],
    order: typeof t.order === "number" ? t.order : 0,
    startMinutes,
    endMinutes,
  };
  // v5 additions — only set when present so older blobs round-trip cleanly.
  if (Array.isArray(t.blockedDomainTags)) {
    const blocked = t.blockedDomainTags.filter((d) => typeof d === "string") as string[];
    if (blocked.length > 0) out.blockedDomainTags = blocked;
  }
  if (t.outcome === "done" || t.outcome === "partial" || t.outcome === "missed") {
    out.outcome = t.outcome;
  }
  if (t.autoCompleted === true) out.autoCompleted = true;
  if (typeof t.completedAt === "number") out.completedAt = t.completedAt;
  const ma = migrateManualAttributions(t.manualAttributions);
  if (ma) out.manualAttributions = ma;
  if (typeof t.sourceTemplateTaskId === "string") out.sourceTemplateTaskId = t.sourceTemplateTaskId;
  if (
    typeof t.sourceTemplateKind === "string" &&
    VALID_TEMPLATE_KINDS.includes(t.sourceTemplateKind as RoutineTemplateKind)
  ) {
    out.sourceTemplateKind = t.sourceTemplateKind as RoutineTemplateKind;
  }
  if (t.skipped === true) out.skipped = true;
  return out;
}

function migrateIdleRanges(raw: unknown): IdleRange[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: IdleRange[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const from = typeof rec.fromMinutes === "number" ? clampMinutes(rec.fromMinutes) : null;
    const to = typeof rec.toMinutes === "number" ? clampMinutes(rec.toMinutes) : null;
    const at = typeof rec.markedAt === "number" ? rec.markedAt : null;
    if (from == null || to == null || at == null || to <= from) continue;
    out.push({ fromMinutes: from, toMinutes: to, markedAt: at });
  }
  return out.length ? out : undefined;
}

function isFiniteSchedule(n: number | null | undefined): boolean {
  return typeof n === "number" && Number.isFinite(n);
}

function clampMinutes(n: number): number {
  if (n < 0) return 0;
  if (n > 1440) return 1440;
  return Math.round(n);
}

function migrateDayData(d: DayData | undefined): DayData {
  if (!d) return createEmptyDayData();
  const out: DayData = { ...d, tasks: (d.tasks ?? []).map(migrateTask) };
  const idle = migrateIdleRanges((d as { idleRanges?: unknown }).idleRanges);
  if (idle) out.idleRanges = idle;
  else delete (out as { idleRanges?: unknown }).idleRanges;
  return out;
}

/** Coerce an unknown-shape rule into the v4 RecurringRule shape. */
function migrateRule(raw: unknown): RecurringRule {
  const r = (raw ?? {}) as Record<string, unknown>;
  const start = isFiniteSchedule(r.defaultStartMinutes as number | null | undefined)
    ? clampMinutes(r.defaultStartMinutes as number)
    : null;
  const dur = isFiniteSchedule(r.defaultDurationMinutes as number | null | undefined)
    ? Math.max(15, Math.round(r.defaultDurationMinutes as number))
    : null;
  const freq = (r.frequency as RecurringRule["frequency"]) || "daily";
  return {
    id: typeof r.id === "string" ? r.id : newId(),
    title: typeof r.title === "string" ? r.title : "",
    description: typeof r.description === "string" ? r.description : "",
    domainTags: Array.isArray(r.domainTags)
      ? (r.domainTags.filter((d) => typeof d === "string") as string[])
      : [],
    ...(Array.isArray(r.blockedDomainTags)
      ? { blockedDomainTags: r.blockedDomainTags.filter((d) => typeof d === "string") as string[] }
      : {}),
    frequency: freq,
    weekdays: Array.isArray(r.weekdays)
      ? (r.weekdays.filter((d) => typeof d === "number") as number[])
      : [],
    monthDays: Array.isArray(r.monthDays)
      ? (r.monthDays.filter((d) => typeof d === "number") as number[])
      : [],
    biweeklyAnchor:
      typeof r.biweeklyAnchor === "string" && r.biweeklyAnchor
        ? r.biweeklyAnchor
        : dayKey(new Date()),
    order: typeof r.order === "number" ? r.order : 0,
    defaultStartMinutes: start,
    defaultDurationMinutes: dur,
  };
}

function defaultV5(): DailyPlannerV5 {
  return {
    v: 5,
    recurringRules: [],
    adHocByDate: {},
    taskDump: JSON.parse(JSON.stringify(DEFAULT_DUMP)) as DayData,
    recurringCompletions: {},
    routineTemplates: defaultRoutineTemplates(),
  };
}

function migrateV1ToV5(v1: DailyPlannerV1): DailyPlannerV5 {
  const adHoc: Record<string, DayData | undefined> = {};
  for (const [key, val] of Object.entries(v1.dayOverrides ?? {})) {
    if (val) adHoc[key] = migrateDayData(val);
  }
  return {
    v: 5,
    recurringRules: [],
    adHocByDate: adHoc,
    taskDump: migrateDayData(v1.taskDump),
    recurringCompletions: {},
    routineTemplates: defaultRoutineTemplates(v1),
  };
}

/** v2 / v3 / v4 / v5 all share the same outer shape — normalize through one path. */
function normalizeV5(raw: unknown): DailyPlannerV5 {
  const defRt = defaultRoutineTemplates();
  const p = (raw ?? {}) as Record<string, unknown>;
  const rt = (p.routineTemplates ?? {}) as Record<string, unknown>;
  const taskDumpRaw = (p.taskDump as DayData | undefined) ?? defaultV5().taskDump;
  const adHocSrc = (p.adHocByDate ?? {}) as Record<string, DayData | undefined>;
  const completions = (p.recurringCompletions ?? {}) as Record<string, boolean>;
  const rules = Array.isArray(p.recurringRules)
    ? (p.recurringRules as unknown[]).map(migrateRule)
    : [];

  return {
    v: 5,
    recurringRules: rules,
    adHocByDate: Object.fromEntries(
      Object.entries(adHocSrc).map(([k, v]) => [k, v ? migrateDayData(v) : v])
    ) as Record<string, DayData | undefined>,
    taskDump: migrateDayData(taskDumpRaw),
    recurringCompletions: completions,
    routineTemplates: {
      fallback: migrateDayData((rt.fallback as DayData | undefined) ?? defRt.fallback),
      weekdays: migrateDayData((rt.weekdays as DayData | undefined) ?? defRt.weekdays),
      // Migrate old single "weekend" key to both saturday and sunday
      saturday: migrateDayData(
        (rt.saturday as DayData | undefined) ??
          (rt.weekend as DayData | undefined) ??
          defRt.saturday
      ),
      sunday: migrateDayData(
        (rt.sunday as DayData | undefined) ??
          (rt.weekend as DayData | undefined) ??
          defRt.sunday
      ),
    },
  };
}

const MAX_KNOWN_VERSION = 5;

export function loadDailyPlanner(): DailyPlannerV5 {
  if (typeof window === "undefined") return defaultV5();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultV5();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const v = parsed.v;
    let migrated: DailyPlannerV5;
    // A `v` number higher than anything this build knows about means a
    // newer client (a future update to this app, or another device already
    // updated) wrote this — the shape is unrecognized, not corrupt. Render
    // empty for now rather than crash, but explicitly skip the persist-back
    // below so the original data isn't overwritten by this build's
    // reconstruction of "empty" — once this client is updated it must still
    // find the real data intact in localStorage.
    const isUnrecognizedFutureVersion = typeof v === "number" && v > MAX_KNOWN_VERSION;
    if (v === 1) {
      migrated = migrateV1ToV5(parsed as unknown as DailyPlannerV1);
    } else if (v === 2 || v === 3 || v === 4 || v === 5) {
      migrated = normalizeV5(parsed);
    } else if (isUnrecognizedFutureVersion) {
      migrated = defaultV5();
    } else {
      return defaultV5();
    }
    if (!migrated.taskDump.groups.length) {
      migrated.taskDump = defaultV5().taskDump;
    }
    if (v !== 5 && !isUnrecognizedFutureVersion) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        /* ignore */
      }
    }
    return migrated;
  } catch {
    return defaultV5();
  }
}

/**
 * Coerce any historical planner shape into v5. Used by the hook when adopting
 * remote data that may have been written by an older client.
 *
 * Returns null when `raw` carries a `v` higher than this build knows about —
 * i.e. it was written by a newer client, not corrupted. This is a *remote*,
 * shared row: silently falling back to defaultV5() here is what used to let
 * an old client wipe another device's newer data and then push that empty
 * default back over it (see callers — none of them may adopt or persist a
 * null return; they must leave whatever they already have untouched
 * instead). Genuinely missing/malformed data (no `v` at all) still defaults
 * to empty, since there's nothing recoverable to protect there.
 */
export function migrateAnyToV5(
  raw:
    | DailyPlannerV1
    | DailyPlannerV2
    | DailyPlannerV3
    | DailyPlannerV4
    | DailyPlannerV5
    | Record<string, unknown>
    | undefined
    | null
): DailyPlannerV5 | null {
  if (!raw) return defaultV5();
  const v = (raw as Record<string, unknown>).v;
  if (v === 1) return migrateV1ToV5(raw as unknown as DailyPlannerV1);
  if (v === 2 || v === 3 || v === 4 || v === 5) return normalizeV5(raw);
  if (typeof v === "number" && v > MAX_KNOWN_VERSION) return null;
  return defaultV5();
}

export function saveDailyPlanner(state: DailyPlannerV5) {
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

function normalizeDomainList(domains: string[]): string[] {
  return domains.map(normalizeDomainInput).filter(Boolean);
}

function pushGroupTasks(
  groups: DayData["groups"],
  tasks: PlannerTask[],
  order: PlannerTaskRule[],
  checkDone: (t: PlannerTask) => boolean
) {
  const pushTask = (t: PlannerTask) => {
    if (!checkDone(t)) return;
    if (t.domainTags.length === 0) return;
    const domains = normalizeDomainList(t.domainTags);
    if (domains.length === 0) return;
    // Unscheduled by construction (task dump / unscheduled rail) — never
    // drives time-based blocking or start/end notifications, so
    // blockedDomains/window are always empty/null.
    order.push({ taskId: t.id, title: t.title, domains, blockedDomains: [], startMinutes: null, endMinutes: null });
  };

  for (const g of sortGroups(groups)) {
    for (const t of tasksInGroup(tasks, g.id)) pushTask(t);
  }
}

/**
 * Tab-time + blocking + notification rules: planned tasks for that day →
 * task dump. Recurring-rule rows are a library only until added to a
 * template or today. Scheduled entries carry their window
 * (startMinutes/endMinutes), title, and blockedDomains so the extension can
 * enforce task-scoped blocking and fire start/ending-soon notifications
 * without any manual toggle — a task's blockedDomains are only ever active
 * while `now` falls inside its own window. Every *scheduled* task is
 * included regardless of whether it has domains/blockedDomains set (a task
 * with neither still deserves a start/end notification), unlike unscheduled
 * tasks below, which only ever exist here for domain-tag attribution.
 *
 * `now` also resolves which recurring rules apply today. A recurring
 * routine only becomes a real entry in `adHocByDate` once the Daily Planner
 * page has been opened that day (the injection effect in
 * useDailyPlannerState.ts runs client-side, once per page session) — but
 * this function is also called headlessly from /api/schedule, polled by the
 * extension every heartbeat with no web app tab open. Without synthesizing
 * today's still-unmaterialized recurring rules here too, a routine's
 * blockedDomains/domains silently never reach the extension until someone
 * happens to open klokrs.com that day, defeating "automatic, no manual
 * toggle" blocking for anyone who doesn't.
 */
export function buildTabTrackingRules(
  state: DailyPlannerV5,
  todayKey: string,
  now: Date
): PlannerTaskRule[] {
  const order: PlannerTaskRule[] = [];

  const adHoc = state.adHocByDate[todayKey] ?? { groups: [], tasks: [] };
  const existingTitles = new Set(adHoc.tasks.map((t) => t.title.trim().toLowerCase()));

  // Scheduled tasks first, in time order — matches "the thing I'm doing now".
  // Merges already-materialized scheduled tasks with recurring rules that
  // apply today, have their own default schedule, and aren't already
  // present (by title, same dedup the client-side injection uses).
  const materializedScheduled = adHoc.tasks
    .filter((t) => !t.done && t.startMinutes != null)
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      domains: normalizeDomainList(t.domainTags),
      blockedDomains: normalizeDomainList(t.blockedDomainTags ?? []),
      startMinutes: t.startMinutes as number,
      endMinutes: t.endMinutes as number,
    }));
  const virtualScheduled = state.recurringRules
    .filter(
      (r) =>
        ruleAppliesOnDate(r, now) &&
        isFiniteSchedule(r.defaultStartMinutes) &&
        isFiniteSchedule(r.defaultDurationMinutes) &&
        !existingTitles.has(r.title.trim().toLowerCase())
    )
    .map((r) => {
      const startMinutes = clampMinutes(r.defaultStartMinutes!);
      const dur = Math.max(15, Math.round(r.defaultDurationMinutes!));
      return {
        taskId: `recurring:${r.id}`,
        title: r.title,
        domains: normalizeDomainList(r.domainTags),
        blockedDomains: normalizeDomainList(r.blockedDomainTags ?? []),
        startMinutes,
        endMinutes: Math.min(1440, startMinutes + dur),
      };
    });
  const scheduled = [...materializedScheduled, ...virtualScheduled].sort(
    (a, b) => a.startMinutes - b.startMinutes
  );
  order.push(...scheduled);

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
