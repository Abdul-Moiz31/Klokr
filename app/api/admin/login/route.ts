import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Single static shared password + no lockout was brute-forceable at whatever
// rate the network allowed. Vercel functions don't share in-process memory
// across invocations, so the limiter has to live in the DB, not a local
// counter — see migration 013_admin_login_rate_limit.sql.
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string };

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!adminEmail || !adminPassword || !sessionSecret) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const ip = clientIp(req);
  const supabase = createAdminClient();

  const { data: allowed, error: rateLimitError } = await supabase.rpc(
    "check_admin_login_rate_limit",
    { p_ip: ip }
  );
  // Fail closed: if the rate-limit check itself errors, don't fall back to
  // "unlimited attempts" — that would silently reopen the exact hole this
  // is meant to close.
  if (rateLimitError) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  if (email !== adminEmail || password !== adminPassword) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  // Correct login — clear this IP's recorded attempts so a mistyped password
  // or two doesn't count against the legitimate admin later this window.
  await supabase.rpc("clear_admin_login_rate_limit", { p_ip: ip });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, sessionSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
