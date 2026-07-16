import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";

// Bare-hostname format only: labels of 1-63 chars (no leading/trailing
// hyphen), joined by dots, 253 chars max overall (the real DNS limit).
// `domain` ends up rendered as text in several places (the extension popup,
// Reports, Activity) — rejecting anything that isn't a plausible hostname
// here closes off that entire class of stored-content issues at the one
// place all of it enters the system, rather than trusting every downstream
// renderer to escape it correctly.
const DOMAIN_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/;

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

    if (!DOMAIN_RE.test(domain)) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
    }

    // Verify the JWT locally — no outbound network call needed. This decodes
    // the payload but does not itself check the signature; PostgREST/GoTrue
    // validates that as part of authenticating the RPC call below (an
    // invalid signature is rejected with 401 before upsert_tab_session's
    // body ever runs). upsert_tab_session is SECURITY DEFINER and bypasses
    // RLS by design, so the sub === user_id check below is real, load-
    // bearing authorization, not just a sanity check — and the RPC itself
    // also independently enforces auth.uid() = p_user_id (migration 018) as
    // defense-in-depth, in case this route is ever bypassed or the function
    // is called directly.
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
