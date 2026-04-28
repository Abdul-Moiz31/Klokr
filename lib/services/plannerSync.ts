import { createClient } from "@/lib/supabase";
import type { DailyPlannerV2 } from "@/lib/daily-planner/types";

type RemoteRow = {
  data: DailyPlannerV2;
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
  plannerData: DailyPlannerV2
): Promise<void> {
  const supabase = createClient();
  await supabase.from("user_planner_data").upsert(
    { user_id: userId, data: plannerData, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
}
