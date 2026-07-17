import type { DailyPlannerV5 } from "./types";

/**
 * Merges `mine` (the state that just failed to write because the remote row
 * changed underneath it) on top of `theirs` (the fresher remote state).
 *
 * This is a conflict-*recovery* step for upsertRemotePlannerIfUnchanged's
 * CAS failure path, not a general-purpose CRDT merge — it does a shallow,
 * key-level union on the two collections where a merge is unambiguous and
 * safe: `adHocByDate` (keyed by calendar date) and `recurringCompletions`
 * (keyed by completion key). Entries that exist in only one side are kept;
 * entries present in *both* sides resolve in favor of `mine`, since it's the
 * edit actively being saved right now.
 *
 * `recurringRules`, `taskDump`, and `routineTemplates` are NOT merged at a
 * sub-level here — `mine`'s version wins outright for those, same as a
 * plain overwrite would have done. Merging them safely would mean
 * reconciling arrays/nested objects with no stable diff key readily
 * available (or, for taskDump, group membership that has to stay
 * consistent), which is real additional work deliberately left out of this
 * pass rather than rushed. In practice `adHocByDate` is where the vast
 * majority of everyday edits happen (today's/this week's tasks), so this
 * covers the realistic "two tabs editing different days" conflict the sync
 * race causes, while the rarer "two tabs editing the exact same day, or a
 * routine template, at the same instant" case is no worse than before —
 * still last-write-wins for that specific slice, not a regression.
 */
export function mergeDailyPlannerV5(mine: DailyPlannerV5, theirs: DailyPlannerV5): DailyPlannerV5 {
  return {
    ...mine,
    adHocByDate: { ...theirs.adHocByDate, ...mine.adHocByDate },
    recurringCompletions: { ...theirs.recurringCompletions, ...mine.recurringCompletions },
  };
}
