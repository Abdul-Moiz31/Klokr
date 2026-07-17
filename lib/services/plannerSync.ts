import { createClient } from "@/lib/supabase";
import type {
  DailyPlannerV1,
  DailyPlannerV2,
  DailyPlannerV3,
  DailyPlannerV4,
  DailyPlannerV5,
} from "@/lib/daily-planner/types";

type RemoteRow = {
  // Remote storage may hold any historical version; the caller migrates.
  data:
    | DailyPlannerV1
    | DailyPlannerV2
    | DailyPlannerV3
    | DailyPlannerV4
    | DailyPlannerV5;
  updated_at: string;
};

export async function fetchRemotePlanner(
  userId: string
): Promise<RemoteRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_planner_data")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RemoteRow;
}

export async function upsertRemotePlanner(
  userId: string,
  plannerData: DailyPlannerV5
): Promise<void> {
  const supabase = createClient();
  await supabase.from("user_planner_data").upsert(
    { user_id: userId, data: plannerData, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
}

export type ConditionalUpsertResult =
  | { ok: true; updatedAt: string }
  | { ok: false; conflict: true; remote: RemoteRow }
  | { ok: false; conflict: false };

/**
 * Atomic compare-and-swap write via upsert_planner_data_if_unchanged
 * (migration 019) — the write only lands if `expectedUpdatedAt` still
 * matches the row's real updated_at, closing the last-write-wins race a
 * plain upsert() has (two tabs/devices writing within the same debounce
 * window, whichever lands second silently discarding the other's edit).
 * On conflict, the RPC returns the current row in the same round trip so
 * the caller can merge and retry without a second fetch.
 */
export async function upsertRemotePlannerIfUnchanged(
  userId: string,
  plannerData: DailyPlannerV5,
  expectedUpdatedAt: string | null
): Promise<ConditionalUpsertResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("upsert_planner_data_if_unchanged", {
    p_user_id: userId,
    p_data: plannerData,
    p_expected_updated_at: expectedUpdatedAt,
  });

  if (error) return { ok: false, conflict: false };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, conflict: false };

  if (row.ok) return { ok: true, updatedAt: row.updated_at as string };
  return {
    ok: false,
    conflict: true,
    remote: { data: row.data as RemoteRow["data"], updated_at: row.updated_at as string },
  };
}
