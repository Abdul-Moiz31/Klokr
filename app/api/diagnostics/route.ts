import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";

function getToken(req: NextRequest): string | null {
  return req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
}

export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseForUserJwt(token);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Server-side reachability check — if we got here, Supabase is reachable.
  const connected = true;

  // Last write by this user in the database.
  const { data: lastWrite } = await supabase
    .from("tab_sessions")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Total sessions recorded today (UTC date for consistency).
  const todayUtc = new Date().toISOString().slice(0, 10);
  const { count: sessionsToday } = await supabase
    .from("tab_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("date", todayUtc);

  return NextResponse.json({
    connected,
    user_id: user.id,
    account_created_at: user.created_at,
    last_db_write: lastWrite?.created_at ?? null,
    sessions_today: sessionsToday ?? 0,
  });
}
