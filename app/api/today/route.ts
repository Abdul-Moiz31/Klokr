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

    const supabase = createSupabaseForUserJwt(auth_token);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(auth_token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("tab_sessions")
      .select("domain, duration_seconds, page_title")
      .eq("user_id", user.id)
      .eq("date", today);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type Session = {
      domain: string;
      duration_seconds: number;
      page_title: string;
    };
    const aggregated = Object.values(
      (data as Session[]).reduce(
        (acc, session) => {
          if (!acc[session.domain]) {
            acc[session.domain] = {
              domain: session.domain,
              total_seconds: 0,
              visits: 0,
            };
          }
          acc[session.domain].total_seconds += session.duration_seconds;
          acc[session.domain].visits += 1;
          return acc;
        },
        {} as Record<
          string,
          { domain: string; total_seconds: number; visits: number }
        >
      )
    ).sort((a, b) => b.total_seconds - a.total_seconds);

    return NextResponse.json({ data: aggregated, date: today });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
