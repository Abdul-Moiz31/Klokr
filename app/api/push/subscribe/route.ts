import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";

async function authed(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const supabase = createSupabaseForUserJwt(token);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { supabase, user };
}

// Registers (or re-registers) this browser's push subscription for the
// logged-in user. Called after the client successfully subscribes via
// PushManager.subscribe() — see lib/hooks/usePushNotifications.ts.
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
  }

  // upsert on endpoint: re-subscribing the same browser (e.g. after clearing
  // site data, or the push service rotating the endpoint) replaces the old
  // row for that endpoint rather than erroring on the unique constraint.
  const { error } = await ctx.supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: ctx.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: "endpoint" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
