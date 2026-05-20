import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";
import { DEFAULT_PREFS, type KlokrsPrefs } from "@/lib/prefs";

function getToken(req: NextRequest): string | null {
  return req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
}

export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseForUserJwt(token);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_preferences")
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stored = (data?.prefs as Partial<KlokrsPrefs>) ?? {};
  const prefs: KlokrsPrefs = {
    ...DEFAULT_PREFS,
    ...stored,
    notifications: { ...DEFAULT_PREFS.notifications, ...(stored.notifications ?? {}) },
  };
  return NextResponse.json({ prefs });
}

export async function POST(request: NextRequest) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseForUserJwt(token);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { prefs?: Partial<KlokrsPrefs> };
  try { body = await request.json() as { prefs?: Partial<KlokrsPrefs> }; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  if (!body.prefs) return NextResponse.json({ error: "Missing prefs" }, { status: 400 });

  const merged: KlokrsPrefs = {
    ...DEFAULT_PREFS,
    ...body.prefs,
    notifications: { ...DEFAULT_PREFS.notifications, ...(body.prefs.notifications ?? {}) },
  };

  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: user.id, prefs: merged, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
