import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";
import { fetchRemotePlanner } from "@/lib/services/plannerSync";
import { buildTabTrackingRules, migrateAnyToV5 } from "@/lib/daily-planner/storage";

/**
 * Pulled by the extension (not pushed by the website) so today's schedule —
 * tracked domains, blocked domains, and each scheduled task's window — is
 * available for tab attribution and task-scoped blocking even when no
 * klokrs.com tab is open. Called from the extension's heartbeat alarm.
 */
export async function GET(request: NextRequest) {
  const auth_token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseForUserJwt(auth_token);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(auth_token);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const remote = await fetchRemotePlanner(user.id);
  if (!remote) {
    return NextResponse.json({ rules: [] });
  }

  const state = migrateAnyToV5(remote.data);
  // Matches the client's own dayKey(new Date()) — both read the day off the
  // instant's UTC calendar date, so "today" always resolves to the same
  // adHocByDate entry the planner UI itself just wrote.
  const rules = buildTabTrackingRules(state, new Date());

  return NextResponse.json({ rules });
}
