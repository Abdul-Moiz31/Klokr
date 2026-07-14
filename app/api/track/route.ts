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

    // Atomic insert-or-increment via upsert_tab_session() (migration 012) —
    // one row per (user, domain, date), enforced by a DB unique constraint.
    // The previous SELECT-then-INSERT/UPDATE here was not atomic: concurrent
    // writes for the same key (two tabs/windows flushing at once, or a
    // retried offline-queue payload landing alongside a fresh save) could
    // both read "no existing row" and duplicate-insert, or both read the same
    // duration_seconds and lose one side's increment. Postgres's
    // `ON CONFLICT ... DO UPDATE` inside the function makes the read+write a
    // single atomic operation, closing both races.
    const { error } = await supabase.rpc("upsert_tab_session", {
      p_user_id: user_id,
      p_domain: domain,
      p_page_title: page_title || domain,
      p_start_time: start_time,
      p_end_time: end_time,
      p_duration_seconds: duration_seconds,
      p_date: date,
      p_is_new_visit: is_new_visit,
      p_planner_task_id: planner_task_id ?? null,
    });

    if (error) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
