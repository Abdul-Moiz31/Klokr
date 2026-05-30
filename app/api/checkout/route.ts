import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";
import { getStripe, priceIdForPlan, type PlanTier } from "@/lib/stripe";

// Creates a Stripe Checkout session for the requested plan and returns its URL.
// The client redirects the browser to that URL. On success/cancel Stripe sends
// the user back to the dashboard; the subscription row is written by the webhook.

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://klokrs.com";
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const supabase = createSupabaseForUserJwt(token);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { plan?: PlanTier };
  try { body = (await request.json()) as { plan?: PlanTier }; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const plan = body.plan;
  if (plan !== "standard" && plan !== "pro") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json({ error: `Price for ${plan} is not configured.` }, { status: 503 });
  }

  // Reuse an existing Stripe customer if we already have one for this user.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(sub?.stripe_customer_id
        ? { customer: sub.stripe_customer_id as string }
        : { customer_email: user.email ?? undefined }),
      // client_reference_id ties the Checkout session back to our user in the
      // webhook, so we never trust the email alone.
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan },
      subscription_data: { metadata: { user_id: user.id, plan } },
      success_url: `${appUrl()}/dashboard/settings?billing=success`,
      cancel_url: `${appUrl()}/dashboard/settings?billing=cancelled`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkout.url });
  } catch {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
