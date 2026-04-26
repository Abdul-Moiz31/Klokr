import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";

export async function GET(request: NextRequest) {
  try {
    const auth_token = request.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!auth_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Local JWT decode — no outbound HTTP call needed.
    // RLS on every DB query enforces the actual signature.
    let jwtSub: string | undefined;
    try {
      const parts = auth_token.split(".");
      if (parts.length === 3) {
        const padded = parts[1]! + "=".repeat((4 - (parts[1]!.length % 4)) % 4);
        const payload = JSON.parse(
          Buffer.from(padded, "base64").toString("utf8")
        ) as { sub?: string; exp?: number };
        const nowSec = Math.floor(Date.now() / 1000);
        if (payload.sub && (payload.exp === undefined || payload.exp >= nowSec)) {
          jwtSub = payload.sub;
        }
      }
    } catch {}

    if (!jwtSub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseForUserJwt(auth_token);

    const { data, error } = await supabase
      .from("tab_sessions")
      .select("domain, date, duration_seconds, visits")
      .eq("user_id", jwtSub)
      .gte("date", start_date)
      .lte("date", end_date);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sessions = data ?? [];

    // ── by_date ────────────────────────────────────────────────────
    const dateMap = new Map<string, number>();
    for (const s of sessions) {
      dateMap.set(s.date, (dateMap.get(s.date) ?? 0) + s.duration_seconds);
    }
    const by_date = Array.from(dateMap.entries())
      .map(([date, total_seconds]) => ({ date, total_seconds }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── by_domain ──────────────────────────────────────────────────
    const domainMap = new Map<string, { total_seconds: number; visit_count: number }>();
    for (const s of sessions) {
      const cur = domainMap.get(s.domain) ?? { total_seconds: 0, visit_count: 0 };
      domainMap.set(s.domain, {
        total_seconds: cur.total_seconds + s.duration_seconds,
        visit_count: cur.visit_count + (s.visits ?? 1),
      });
    }

    const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
    const safeTotal = totalSeconds || 1;

    const by_domain = Array.from(domainMap.entries())
      .map(([domain, { total_seconds, visit_count }]) => ({
        domain,
        total_seconds,
        visit_count,
        percentage_of_total:
          Math.round((total_seconds / safeTotal) * 1000) / 10,
      }))
      .sort((a, b) => b.total_seconds - a.total_seconds);

    return NextResponse.json({ by_date, by_domain });
  } catch (e) {
    console.error("[api/reports] uncaught:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
