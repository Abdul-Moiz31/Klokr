import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "@/lib/admin-auth";
import { safeEqual } from "@/lib/crypto";

// Single static shared password + no lockout was brute-forceable at whatever
// rate the network allowed. Vercel functions don't share in-process memory
// across invocations, so the limiter has to live in the DB, not a local
// counter — see migration 013_admin_login_rate_limit.sql.
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for is a hop chain where each proxy appends the IP it
    // received the request from. A client can set the *first* entry to
    // anything it wants (previously used here — that let an attacker mint a
    // fresh "IP" on every request and fully evade the rate limit), but
    // cannot control the *last* entry: that one is appended by Vercel's own
    // edge network from the real TCP connection, so it's the trustworthy one.
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string };

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
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

  if (!safeEqual(email ?? "", adminEmail) || !safeEqual(password ?? "", adminPassword)) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  // Correct login — clear this IP's recorded attempts so a mistyped password
  // or two doesn't count against the legitimate admin later this window.
  await supabase.rpc("clear_admin_login_rate_limit", { p_ip: ip });

  const { token, expiresAt } = await createAdminSession();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: expiresAt,
    path: "/",
  });
  return res;
}
