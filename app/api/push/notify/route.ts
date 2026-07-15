import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";
import { sendPushToUser, type PushPayload } from "@/lib/push";

// Lets an authenticated client (the in-app notification generator,
// lib/notifications.ts) trigger a Web Push for a notification it just
// created, without ever handling the VAPID private key or service-role
// client itself — those stay entirely server-side (lib/push.ts). Always
// sends to the CALLER's own user_id (from their verified JWT), never a
// client-supplied one, so this can't be used to push-bomb another user.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseForUserJwt(token);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { notifications?: PushPayload[] };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const items = (body.notifications ?? []).slice(0, 10); // sane cap, not attacker-controlled fan-out
  await Promise.all(items.map((n) => sendPushToUser(user.id, n)));

  return NextResponse.json({ ok: true });
}
