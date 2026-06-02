import type { SupabaseClient } from "@supabase/supabase-js";
import { isPaidStatus, type PlanTier } from "@/lib/stripe";

export type Subscription = {
  plan: PlanTier;
  status: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  isPaid: boolean;
};

const FREE: Subscription = {
  plan: "free",
  status: null,
  currentPeriodEnd: null,
  stripeCustomerId: null,
  isPaid: false,
};

// Reads the caller's subscription row. Pass a JWT-scoped client (RLS lets the
// user read their own row). Returns the free-tier default when there's no row
// or billing isn't set up — callers can treat everyone as free safely.
export async function getUserSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<Subscription> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return FREE;

  const status = (data.status as string | null) ?? null;
  // Downgrade to free if the plan is set but the subscription is no longer paid
  // (e.g. canceled but the row hasn't been reset).
  const paid = isPaidStatus(status);
  return {
    plan: paid ? ((data.plan as PlanTier) ?? "free") : "free",
    status,
    currentPeriodEnd: (data.current_period_end as string | null) ?? null,
    stripeCustomerId: (data.stripe_customer_id as string | null) ?? null,
    isPaid: paid,
  };
}
