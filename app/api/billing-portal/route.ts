import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";
import { getStripe } from "@/lib/stripe";

// Returns a Stripe Customer Portal URL so a paying user can manage or cancel
// their subscription. Requires an existing Stripe customer (set by the webhook).

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://klokrs.com";
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const supabase = createSupabaseForUserJwt(token);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = sub?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "No billing account found." }, { status: 400 });
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/dashboard/settings`,
    });
    return NextResponse.json({ url: portal.url });
  } catch {
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 502 });
  }
}
