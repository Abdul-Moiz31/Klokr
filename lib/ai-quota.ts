import type { SupabaseClient } from "@supabase/supabase-js";

// AI usage quotas per plan (calls per calendar month on Klokrs's key). When a
// user brings their own key, usage is unmetered and these limits don't apply.
export type PlanTier = "free" | "standard" | "pro";

export const AI_MONTHLY_LIMIT: Record<PlanTier, number> = {
  free: 2,
  standard: 30,
  pro: 1000, // effectively unlimited; a guardrail against runaway loops
};

export function currentYearMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Resolve the user's plan from the subscriptions table. Self-contained so this
// works on a branch without the full billing lib; honors a manual admin grant
// if that column exists (added by the admin-plans migration). Defaults to free.
export async function resolvePlan(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanTier> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, manual_plan, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return "free";

  const manual = (data.manual_plan as PlanTier | null | undefined) ?? null;
  if (manual && manual !== "free") return manual;

  const status = (data.status as string | null) ?? null;
  const paid = status === "active" || status === "trialing" || status === "manual";
  return paid ? ((data.plan as PlanTier) ?? "free") : "free";
}

export async function getMonthlyUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from("ai_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("year_month", currentYearMonth())
    .maybeSingle();
  return (data?.count as number | undefined) ?? 0;
}

export type QuotaStatus = {
  plan: PlanTier;
  used: number;
  limit: number;
  remaining: number;
  hasOwnKey: boolean;
  /** True when the user can make an AI call right now. */
  allowed: boolean;
};

export async function getQuotaStatus(
  supabase: SupabaseClient,
  userId: string,
  hasOwnKey: boolean
): Promise<QuotaStatus> {
  const plan = await resolvePlan(supabase, userId);
  const limit = AI_MONTHLY_LIMIT[plan];
  const used = await getMonthlyUsage(supabase, userId);
  const remaining = Math.max(0, limit - used);
  return {
    plan,
    used,
    limit,
    remaining,
    hasOwnKey,
    // Own key → always allowed (unmetered). Otherwise gated by remaining quota.
    allowed: hasOwnKey || remaining > 0,
  };
}

// Atomically increment monthly usage via the SECURITY DEFINER function. Pass a
// service-role client (the RPC writes under RLS). Returns the new count.
export async function incrementUsage(
  serviceClient: SupabaseClient,
  userId: string
): Promise<void> {
  await serviceClient.rpc("increment_ai_usage", {
    p_user_id: userId,
    p_year_month: currentYearMonth(),
  });
}
