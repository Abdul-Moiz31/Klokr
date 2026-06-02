import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planForPriceId } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-admin";

// Stripe webhook. Verifies the signature against the raw body, then mirrors
// subscription state into the `subscriptions` table via the service-role
// client (the only writer — RLS has no user write policy). Idempotent: every
// handled event is an upsert keyed by user_id.

// Resolve our user_id from the Stripe objects. We set it as metadata at
// checkout, so it's present on both the session and the subscription.
function userIdFromSubscription(sub: Stripe.Subscription): string | null {
  return (sub.metadata?.user_id as string | undefined) ?? null;
}

async function upsertFromSubscription(sub: Stripe.Subscription) {
  const userId = userIdFromSubscription(sub);
  if (!userId) return; // can't map back to a user — skip rather than guess

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const periodEnd = sub.items.data[0]?.current_period_end ?? null;
  const admin = createAdminClient();
  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      status: sub.status,
      plan: planForPriceId(priceId),
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Billing not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  // Raw body is required for signature verification — do not parse as JSON first.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          // Carry the user_id from the session onto the subscription metadata in
          // case it wasn't propagated, then upsert.
          if (!sub.metadata?.user_id && session.client_reference_id) {
            sub.metadata = { ...sub.metadata, user_id: session.client_reference_id };
          }
          await upsertFromSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertFromSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break; // ignore unhandled event types
    }
  } catch {
    // Return 500 so Stripe retries — the handler is idempotent, so retries are safe.
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
