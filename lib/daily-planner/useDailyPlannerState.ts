"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DailyPlannerV2,
  DayData,
  RecurringRule,
  RoutineTemplateKind,
} from "./types";
import {
  buildTabTrackingRules,
  dayDataWithFreshIds,
  dayKey,
  loadDailyPlanner,
  newId,
  saveDailyPlanner,
} from "./storage";
import { completionKey } from "./recurrence";
import { suggestedRoutineTemplateKind } from "./date";
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

  // Auto-apply the matching day template when today has no ad-hoc tasks yet.
  // Runs once after hydration. If the user has already planned today (tasks exist),
  // or the relevant template is empty, nothing happens.
  useEffect(() => {
    if (!hydrated || !state || autoAppliedRef.current) return;
    autoAppliedRef.current = true;

    const todayK = dayKey(new Date());
    if (state.adHocByDate[todayK] != null) return; // already has tasks for today

    const kind = suggestedRoutineTemplateKind(new Date());
    const dayTemplate = state.routineTemplates[kind];
    // Fall back to the generic "fallback" template if the day-specific one is empty.
    const src = dayTemplate.tasks.length > 0 ? dayTemplate : state.routineTemplates.fallback;
    if (src.tasks.length === 0) return; // no template configured yet — nothing to apply

    update((s) => {
      // Double-check inside the updater in case state changed between the check above
      // and this call (e.g. remote sync arriving at the same moment).
      if (s.adHocByDate[todayK] != null) return s;
      s.adHocByDate[todayK] = dayDataWithFreshIds(deepClone(src));
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
    (rule: RecurringRule) => {
      update((s) => {
        s.recurringRules = [...s.recurringRules, rule];
        return s;
      });
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
    (r: RecurringRule) => {
      update((s) => {
        const i = s.recurringRules.findIndex((x) => x.id === r.id);
        if (i < 0) return s;
        s.recurringRules = [...s.recurringRules];
        s.recurringRules[i] = r;
        return s;
      });
    },
    [update]
  );

  const removeRecurringRule = useCallback(
    (id: string) => {
      update((s) => {
        s.recurringRules = s.recurringRules.filter((r) => r.id !== id);
        s.recurringCompletions = Object.fromEntries(
          Object.entries(s.recurringCompletions).filter(
            ([key]) => !key.startsWith(`${id}:`)
          )
        );
        return s;
      });
    },
    [update]
  );

  const toggleRecurringDone = useCallback(
    (ruleId: string, d: Date) => {
      const key = completionKey(ruleId, d);
      update((s) => {
        const next = { ...s.recurringCompletions };
        if (next[key]) {
          delete next[key];
        } else {
          next[key] = true;
        }
        s.recurringCompletions = next;
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
    toggleRecurringDone,
    newId,
    getTrackingRules,
    setRoutineTemplate,
    applyRoutineTemplateToToday,
  };
}
