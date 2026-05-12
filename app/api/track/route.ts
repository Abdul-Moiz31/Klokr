import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";

export async function POST(request: NextRequest) {
  try {
    // Auth token comes from the Authorization header, not the body.
    const authHeader = request.headers.get("authorization") ?? "";
    const auth_token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    const body = (await request.json()) as {
      user_id: string;
      domain: string;
      page_title: string;
      start_time: string;
      end_time: string;
      duration_seconds: number;
      date: string;
      planner_task_id?: string | null;
      is_new_visit?: boolean;
    };

    const {
      user_id,
      domain,
      page_title,
      start_time,
      end_time,
      duration_seconds,
      date,
      planner_task_id,
      is_new_visit = false,
    } = body;

    if (
      !user_id ||
      !domain ||
      !start_time ||
      !end_time ||
      !duration_seconds ||
      !date ||
      !auth_token
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (duration_seconds < 1) {
      return NextResponse.json(
        { error: "Duration too short" },
        { status: 400 }
      );
    }

    // Verify the JWT locally — no outbound network call needed.
    // The actual signature is validated by Supabase RLS on every DB query below.
    let jwtSub: string | undefined;
    try {
      const parts = auth_token.split(".");
      if (parts.length === 3) {
        const padded = parts[1]! + "=".repeat((4 - (parts[1]!.length % 4)) % 4);
        const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
          sub?: string;
          exp?: number;
        };
        const nowSec = Math.floor(Date.now() / 1000);
        if (payload.sub && (payload.exp === undefined || payload.exp >= nowSec)) {
          jwtSub = payload.sub;
        }
      }
    } catch {}

    if (!jwtSub || jwtSub !== user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseForUserJwt(auth_token);

    // Upsert: one row per (user, domain, date). Increment on repeat visits.
    // .limit(1) prevents PGRST116 when old data has multiple rows for the same key.
    // We target the most-recently-created row so increments consolidate over time.
    const { data: existing, error: fetchError } = await supabase
      .from("tab_sessions")
      .select("id, duration_seconds, visits")
      .eq("user_id", user_id)
      .eq("domain", domain)
      .eq("date", date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (existing) {
      const { error } = await supabase
        .from("tab_sessions")
        .update({
          duration_seconds: existing.duration_seconds + duration_seconds,
          visits: (existing.visits ?? 0) + (is_new_visit ? 1 : 0),
          end_time,
          page_title: page_title || domain,
          ...(planner_task_id ? { planner_task_id } : {}),
        })
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    } else {
      const row: Record<string, unknown> = {
        user_id,
        domain,
        page_title: page_title || domain,
        start_time,
        end_time,
        duration_seconds,
        date,
        visits: 1,
      };
      if (planner_task_id) row.planner_task_id = planner_task_id;

      const { error } = await supabase.from("tab_sessions").insert(row);
      if (error) {
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
