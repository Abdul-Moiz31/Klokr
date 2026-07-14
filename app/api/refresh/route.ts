import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { refresh_token?: string };
    const { refresh_token } = body;

    if (!refresh_token) {
      return NextResponse.json({ error: "refresh_token required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const res = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ refresh_token }),
      }
    );

    if (!res.ok) {
      let detail: { error?: string; error_description?: string } = {};
      try { detail = (await res.json()) as typeof detail; } catch { /* non-JSON error body */ }
      const description = detail.error_description || detail.error || "";
      // Supabase returns "invalid_grant" + a description like "Already Used"
      // or "Not Found" when this exact refresh token was already rotated —
      // e.g. by the same account's extension on a different device, since
      // refresh tokens are single-use. That's permanent: retrying with the
      // same stored token can never succeed, unlike a network blip or 5xx.
      // Forward which kind this is so the caller can stop retrying a token
      // that can never come back instead of hammering it forever.
      const permanent = /already used|not found|revoked/i.test(description);
      return NextResponse.json({ error: "Token refresh failed", permanent }, { status: 401 });
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };

    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
