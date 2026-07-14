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

export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { endpoint?: string };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  if (!body.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  // RLS (auth.uid() = user_id) already scopes this to the caller's own rows —
  // the .eq("user_id", ...) here is defense in depth, not the only guard.
  const { error } = await ctx.supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", ctx.user.id)
    .eq("endpoint", body.endpoint);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
