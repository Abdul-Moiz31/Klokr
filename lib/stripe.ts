import Stripe from "stripe";

// Server-only Stripe client. Returns null when STRIPE_SECRET_KEY is unset so
// the billing routes can degrade gracefully (503) instead of throwing at import.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key);
  return _stripe;
}

export type PlanTier = "free" | "standard" | "pro";

// Map a Stripe price ID → our internal plan tier. Price IDs come from env so
// the same code works across test/live without edits.
export function planForPriceId(priceId: string | null | undefined): PlanTier {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_STANDARD) return "standard";
  return "free";
}

export function priceIdForPlan(plan: PlanTier): string | null {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO ?? null;
  if (plan === "standard") return process.env.STRIPE_PRICE_STANDARD ?? null;
  return null;
}

// Active-ish statuses that should grant paid features.
export function isPaidStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}
