import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";
import { fetchRemotePlanner } from "@/lib/services/plannerSync";
import { buildTabTrackingRules, migrateAnyToV5 } from "@/lib/daily-planner/storage";
import { dayKeyForOffset } from "@/lib/daily-planner/date";

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
    return NextResponse.json({ rules: [], summary: { total: 0, completed: 0 } });
  }

  const state = migrateAnyToV5(remote.data);
  if (!state) {
    // Written by a newer client version this build doesn't recognize — fail
    // open the same way as "no remote row at all" rather than guessing at
    // its shape. The extension already treats an empty ruleset as "nothing
    // scheduled today," and will pick up real rules on its next heartbeat
    // once this deploy is updated.
    return NextResponse.json({ rules: [], summary: { total: 0, completed: 0 } });
  }
  // The server's runtime timezone is never the user's, so "today" has to be
  // resolved using the caller's own offset — same x-tz-offset convention as
  // /api/today. This is what the client's own dayKey(new Date()) resolves to
  // in the browser, so both sides agree on which adHocByDate entry is "today".
  const tzOffset = parseInt(request.headers.get("x-tz-offset") ?? "0", 10) || 0;
  const now = new Date();
  const todayKey = dayKeyForOffset(now, tzOffset);
  // Recurring-rule matching (ruleAppliesOnDate) reads local getDay()/getDate(),
  // which only resolve to the caller's calendar day if this runtime's own
  // timezone is UTC (true on Vercel) — same assumption dayKeyForOffset makes,
  // shifted the same way so both agree on "today".
  const localEquivalentNow = new Date(now.getTime() - tzOffset * 60_000);
  const rules = buildTabTrackingRules(state, todayKey, localEquivalentNow);

  // Unlike `rules` (which drops already-done tasks), the day-complete
  // notification needs the full picture — every scheduled task today,
  // done or not — to report "N of M tasks completed".
  const today = state.adHocByDate[todayKey];
  const scheduledToday = (today?.tasks ?? []).filter((t) => t.startMinutes != null);
  const summary = {
    total: scheduledToday.length,
    completed: scheduledToday.filter((t) => t.done).length,
  };

  return NextResponse.json({ rules, summary });
}
