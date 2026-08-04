import { NextResponse, type NextRequest } from "next/server";

// Routes that require a signed-in Supabase user. /admin is intentionally
// excluded — it has its own independent session model (ADMIN_PASSWORD +
// a separate hashed cookie, see lib/admin-auth.ts) enforced server-side by
// app/admin/(protected)/layout.tsx, not Supabase auth. Redirecting it to
// /login here would lock admins out entirely.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/activity",
  "/reports",
  "/pomodoro",
  "/daily-planner",
  "/routine-templates",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Supabase auth cookies are named `sb-<project-ref>-auth-token`, split into
// `.0`, `.1`, ... chunks when the session is large.
const SESSION_COOKIE_RE = /^sb-.*-auth-token/;

export async function proxy(request: NextRequest) {
  // Deliberately NOT calling supabase.auth.getUser()/getSession() here.
  // Those trigger a network refresh when the access token is expired, and
  // the extension is the sole owner of the rotating refresh token (see
  // lib/supabase.ts) — it refreshes proactively every ~55min, 24/7, whether
  // or not a dashboard tab is open. If this middleware also refreshed using
  // whatever (possibly already-rotated-out) refresh token happens to be
  // sitting in the request cookies, Supabase's reuse-detection treats it as
  // a replay attack and revokes the entire session family — logging the
  // user out everywhere, including the extension's still-valid copy. That
  // was the root cause of users getting signed out roughly once a day.
  //
  // This check only decides whether to redirect for UX purposes (avoiding a
  // flash of protected content); it isn't a security boundary — actual data
  // access is enforced by Supabase RLS using the client's real token. The
  // client-side bridge (ExtensionAuthSync + useAuthSession) reconciles the
  // real session from the extension's fresh copy within a few hundred ms.
  //
  // Deliberately one-directional: we only redirect *away* from protected
  // pages when there's no session cookie at all. We don't redirect *away*
  // from /login or /signup for an already-authenticated visitor — cookie
  // presence alone doesn't mean the cookie is still valid (e.g. a stale
  // cookie left over from a previous account), and bouncing a visitor who
  // is trying to sign in as a different account straight to /dashboard
  // before they can even click "Continue with Google" is a worse failure
  // mode than occasionally showing the login form to someone already
  // signed in.
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => SESSION_COOKIE_RE.test(c.name));

  if (!hasSessionCookie && isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/activity/:path*",
    "/reports/:path*",
    "/pomodoro/:path*",
    "/daily-planner/:path*",
    "/routine-templates/:path*",
    "/admin/:path*",
  ],
};
