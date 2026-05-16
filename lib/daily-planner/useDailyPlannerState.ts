"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DailyPlannerV2,
  DayData,
  RecurringRule,
  RoutineTemplateKind,
} from "./types";
import {
  appendRecurringRuleAsTaskToDayData,
  buildTabTrackingRules,
  createEmptyDayData,
  dayDataWithFreshIds,
  dayKey,
  loadDailyPlanner,
  newId,
  saveDailyPlanner,
} from "./storage";
import { suggestedRoutineTemplateKind } from "./date";
import { ruleAppliesOnDate } from "./recurrence";
import { fetchRemotePlanner, upsertRemotePlanner } from "@/lib/services/plannerSync";
import { getAuthUser } from "@/lib/services/userPreferences";

const SYNC_DEBOUNCE_MS = 2000;

function deepClone<T>(x: T): T {
  if (typeof structuredClone === "function") return structuredClone(x);
  return JSON.parse(JSON.stringify(x)) as T;
}

export function useDailyPlannerState() {
  const [state, setState] = useState<DailyPlannerV2 | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);
  // Ensures we auto-apply a template at most once per page session.
  const autoAppliedRef = useRef(false);

  // 1. Hydrate from localStorage immediately, then merge with Supabase in background.
  useEffect(() => {
    const local = loadDailyPlanner();
    setState(local);
    setHydrated(true);

    void (async () => {
      const user = await getAuthUser();
      if (!user) return;

      const remote = await fetchRemotePlanner(user.id);
      if (!remote) return;

      // If remote is newer than what we loaded from localStorage, adopt it.
      const localTs = localStorage.getItem("Klokrs_planner_synced_at") ?? "0";
      if (remote.updated_at > localTs) {
        setState(remote.data);
        saveDailyPlanner(remote.data);
        localStorage.setItem("Klokrs_planner_synced_at", remote.updated_at);
      }
    })();
  }, []);

  // 2. On every state change: save to localStorage immediately, debounce Supabase write.
  useEffect(() => {
    if (!state) return;
    saveDailyPlanner(state);

    // Skip the debounced remote write on the very first load (we just loaded from remote).
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void (async () => {
        const user = await getAuthUser();
        if (!user) return;
        await upsertRemotePlanner(user.id, state);
        localStorage.setItem("Klokrs_planner_synced_at", new Date().toISOString());
      })();
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [state]);

  const update = useCallback((fn: (s: DailyPlannerV2) => DailyPlannerV2) => {
    setState((prev) => (prev ? fn(deepClone(prev)) : null));
  }, []);

  // Auto-apply on hydration:
  // 1. If today has no tasks yet, load the matching day template (weekday/sat/sun/fallback).
  // 2. Inject any recurring rules that apply today and aren't already present (by title).
  // Runs once per page session via autoAppliedRef.
  useEffect(() => {
    if (!hydrated || !state || autoAppliedRef.current) return;
    autoAppliedRef.current = true;

    const today = new Date();
    const todayK = dayKey(today);

    update((s) => {
      // Step 1: load day template if today is empty
      if (s.adHocByDate[todayK] == null) {
        const kind = suggestedRoutineTemplateKind(today);
        const dayTemplate = s.routineTemplates[kind];
        const src = dayTemplate.tasks.length > 0 ? dayTemplate : s.routineTemplates.fallback;
        if (src.tasks.length > 0) {
          s.adHocByDate[todayK] = dayDataWithFreshIds(deepClone(src));
        }
      }

      // Step 2: inject recurring rules that apply today and aren't already in the plan
      const todayRules = s.recurringRules.filter((r) => ruleAppliesOnDate(r, today));
      if (todayRules.length === 0) return s;

      const cur = s.adHocByDate[todayK] ?? createEmptyDayData();
      const existingTitles = new Set(cur.tasks.map((t) => t.title.trim().toLowerCase()));

      let dayData = cur;
      for (const rule of todayRules) {
        if (existingTitles.has(rule.title.trim().toLowerCase())) continue;
        dayData = appendRecurringRuleAsTaskToDayData(deepClone(dayData), rule, newId);
        existingTitles.add(rule.title.trim().toLowerCase());
      }
      s.adHocByDate[todayK] = dayData;

      return s;
    });
  }, [hydrated, state, update]);

  const getTodayKey = useCallback(() => dayKey(new Date()), []);

  const setAdHocForDate = useCallback(
    (dateKey: string, data: DayData) => {
      update((s) => {
        s.adHocByDate[dateKey] = data;
        return s;
      });
    },
    [update]
  );

  const setTodayAdHoc = useCallback(
    (data: DayData) => {
      const k = dayKey(new Date());
      setAdHocForDate(k, data);
    },
    [setAdHocForDate]
  );

  const setTaskDump = useCallback(
    (data: DayData) => {
      update((s) => {
        s.taskDump = data;
        return s;
      });
    },
    [update]
  );

  const clearAdHocForToday = useCallback(() => {
    const k = dayKey(new Date());
    update((s) => {
      delete s.adHocByDate[k];
      return s;
    });
  }, [update]);

  const setRecurringRules = useCallback(
    (rules: RecurringRule[]) => {
      update((s) => {
        s.recurringRules = rules;
        return s;
      });
    },
    [update]
  );

  const addRecurringRule = useCallback(
    (rule: RecurringRule): boolean => {
      let addedToday = false;
      update((s) => {
        s.recurringRules = [...s.recurringRules, rule];

        // If the new rule applies today, inject it immediately into today's plan
        // (the one-time auto-apply effect has already run, so we do it here).
        const today = new Date();
        if (ruleAppliesOnDate(rule, today)) {
          const k = dayKey(today);
          const cur = s.adHocByDate[k] ?? createEmptyDayData();
          const alreadyPresent = cur.tasks.some(
            (t) => t.title.trim().toLowerCase() === rule.title.trim().toLowerCase()
          );
          if (!alreadyPresent) {
            s.adHocByDate[k] = appendRecurringRuleAsTaskToDayData(deepClone(cur), rule, newId);
            addedToday = true;
          }
        }

        return s;
      });
      return addedToday;
    },
    [update]
  );

  const updateRecurringRule = useCallback(
    (id: string, patch: Partial<RecurringRule>) => {
      update((s) => {
        s.recurringRules = s.recurringRules.map((r) =>
          r.id === id ? ({ ...r, ...patch } as RecurringRule) : r
        );
        return s;
      });
    },
    [update]
  );

  const replaceRecurringRule = useCallback(
    (r: RecurringRule): "added" | "removed" | null => {
      let effect: "added" | "removed" | null = null;
      update((s) => {
        const i = s.recurringRules.findIndex((x) => x.id === r.id);
        if (i < 0) return s;
        const prev = s.recurringRules[i]!;
        s.recurringRules = [...s.recurringRules];
        s.recurringRules[i] = r;

        const today = new Date();
        const k = dayKey(today);
        const titleLower = r.title.trim().toLowerCase();
        const prevTitleLower = prev.title.trim().toLowerCase();
        const appliesNow = ruleAppliesOnDate(r, today);
        const appliedBefore = ruleAppliesOnDate(prev, today);

        if (appliesNow && !appliedBefore) {
          // Day was added — inject if not present
          const cur = s.adHocByDate[k] ?? createEmptyDayData();
          const alreadyPresent = cur.tasks.some((t) => t.title.trim().toLowerCase() === titleLower);
          if (!alreadyPresent) {
            s.adHocByDate[k] = appendRecurringRuleAsTaskToDayData(deepClone(cur), r, newId);
            effect = "added";
          }
        } else if (!appliesNow && appliedBefore) {
          // Day was removed — remove from today's plan
          const cur = s.adHocByDate[k];
          if (cur) {
            cur.tasks = cur.tasks.filter((t) => t.title.trim().toLowerCase() !== prevTitleLower);
            effect = "removed";
          }
        } else if (appliesNow && prev.title !== r.title) {
          // Title changed — update existing task title in today's plan
          const cur = s.adHocByDate[k];
          if (cur) {
            cur.tasks = cur.tasks.map((t) =>
              t.title.trim().toLowerCase() === prevTitleLower ? { ...t, title: r.title } : t
            );
          }
        }

        return s;
      });
      return effect;
    },
    [update]
  );

  const removeRecurringRule = useCallback(
    (id: string): string | null => {
      let removedTitle: string | null = null;
      update((s) => {
        const rule = s.recurringRules.find((r) => r.id === id);
        if (rule) removedTitle = rule.title;
        s.recurringRules = s.recurringRules.filter((r) => r.id !== id);
        s.recurringCompletions = Object.fromEntries(
          Object.entries(s.recurringCompletions).filter(
            ([key]) => !key.startsWith(`${id}:`)
          )
        );
        // Remove from today's plan if present
        if (rule) {
          const k = dayKey(new Date());
          const cur = s.adHocByDate[k];
          if (cur) {
            const titleLower = rule.title.trim().toLowerCase();
            cur.tasks = cur.tasks.filter((t) => t.title.trim().toLowerCase() !== titleLower);
          }
        }
        return s;
      });
      return removedTitle;
    },
    [update]
  );

  const appendRecurringRuleToTemplate = useCallback(
    (kind: RoutineTemplateKind, rule: RecurringRule) => {
      update((s) => {
        const cur = s.routineTemplates[kind];
        s.routineTemplates[kind] = appendRecurringRuleAsTaskToDayData(
          deepClone(cur),
          rule,
          newId
        );
        return s;
      });
    },
    [update]
  );

  const appendRecurringRuleToToday = useCallback(
    (rule: RecurringRule): boolean => {
      let isDuplicate = false;
      update((s) => {
        const k = dayKey(new Date());
        const cur = s.adHocByDate[k] ?? createEmptyDayData();
        const existingTitles = new Set(cur.tasks.map((t) => t.title.trim().toLowerCase()));
        isDuplicate = existingTitles.has(rule.title.trim().toLowerCase());
        if (isDuplicate) return s; // caller will confirm before forcing
        s.adHocByDate[k] = appendRecurringRuleAsTaskToDayData(deepClone(cur), rule, newId);
        return s;
      });
      return isDuplicate;
    },
    [update]
  );

  const forceAppendRecurringRuleToToday = useCallback(
    (rule: RecurringRule) => {
      update((s) => {
        const k = dayKey(new Date());
        const cur = s.adHocByDate[k] ?? createEmptyDayData();
        s.adHocByDate[k] = appendRecurringRuleAsTaskToDayData(deepClone(cur), rule, newId);
        return s;
      });
    },
    [update]
  );

  const setRoutineTemplate = useCallback(
    (kind: RoutineTemplateKind, data: DayData) => {
      update((s) => {
        s.routineTemplates[kind] = data;
        return s;
      });
    },
    [update]
  );

  const applyRoutineTemplateToToday = useCallback(
    (kind: RoutineTemplateKind) => {
      update((s) => {
        const k = dayKey(new Date());
        const src = s.routineTemplates[kind];
        s.adHocByDate[k] = dayDataWithFreshIds(deepClone(src));
        return s;
      });
    },
    [update]
  );

  const getTrackingRules = useCallback(() => {
    if (!state) return [];
    return buildTabTrackingRules(state, new Date());
  }, [state]);

  return {
    state,
    hydrated,
    patchState: update,
    getTodayKey,
    setTodayAdHoc,
    setAdHocForDate,
    setTaskDump,
    clearAdHocForToday,
    setRecurringRules,
    addRecurringRule,
    updateRecurringRule,
    replaceRecurringRule,
    removeRecurringRule,
    appendRecurringRuleToTemplate,
    appendRecurringRuleToToday,
    forceAppendRecurringRuleToToday,
    newId,
    getTrackingRules,
    setRoutineTemplate,
    applyRoutineTemplateToToday,
  };
}
