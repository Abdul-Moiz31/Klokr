"use client";

import { useCallback, useEffect, useState } from "react";
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

function deepClone<T>(x: T): T {
  if (typeof structuredClone === "function") return structuredClone(x);
  return JSON.parse(JSON.stringify(x)) as T;
}

export function useDailyPlannerState() {
  const [state, setState] = useState<DailyPlannerV2 | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load from localStorage
    setState(loadDailyPlanner());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (state) saveDailyPlanner(state);
  }, [state]);

  const update = useCallback((fn: (s: DailyPlannerV2) => DailyPlannerV2) => {
    setState((prev) => (prev ? fn(deepClone(prev)) : null));
  }, []);

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
