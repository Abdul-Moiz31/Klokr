import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanTier } from "@/lib/stripe";

// Plan hierarchy: a higher tier includes everything in the tiers below it.
const TIER_RANK: Record<PlanTier, number> = { free: 0, standard: 1, pro: 2 };

export function planIncludes(userPlan: PlanTier, requiredTier: PlanTier): boolean {
  return TIER_RANK[userPlan] >= TIER_RANK[requiredTier];
}

export type FeatureFlagRow = {
  tier: PlanTier;
  feature_key: string | null;
  enabled: boolean;
};

/**
 * Loads enabled feature flags (RLS allows reading enabled rows). Returns a map
 * of feature_key → the LOWEST tier that grants it. A user with a plan at or
 * above that tier has the feature.
 *
 * feature_flags is the source of truth: an admin enabling/disabling a flag, or
 * moving a feature to a different tier, changes access for everyone.
 */
export async function loadFeatureTierMap(
  supabase: SupabaseClient
): Promise<Map<string, PlanTier>> {
  const { data } = await supabase
    .from("feature_flags")
    .select("tier, feature_key, enabled")
    .eq("enabled", true);

  const map = new Map<string, PlanTier>();
  for (const row of (data as FeatureFlagRow[] | null) ?? []) {
    if (!row.feature_key) continue; // display-only flag (no machine key)
    const existing = map.get(row.feature_key);
    // Keep the lowest tier that grants this key (most generous).
    if (!existing || TIER_RANK[row.tier] < TIER_RANK[existing]) {
      map.set(row.feature_key, row.tier);
    }
  }
  return map;
}

/**
 * Does `userPlan` grant `featureKey`, given the flag map?
 * Unknown keys (not configured in feature_flags) default to DENIED for paid
 * features — configure the flag to grant access. Pass a fallback tier for keys
 * you want to default-allow if unconfigured.
 */
export function hasFeature(
  featureTierMap: Map<string, PlanTier>,
  userPlan: PlanTier,
  featureKey: string,
  fallbackTier: PlanTier | null = null
): boolean {
  const requiredTier = featureTierMap.get(featureKey) ?? fallbackTier;
  if (requiredTier == null) return false; // unconfigured + no fallback → deny
  return planIncludes(userPlan, requiredTier);
}
