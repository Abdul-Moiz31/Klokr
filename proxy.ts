import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ONLY_ROUTES = new Set(["/login", "/signup"]);

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

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() forces a token refresh when expired and triggers setAll() above,
  // writing the refreshed cookies onto the response. Without this, the access
  // token expires after 1h and the browser client's refreshed session never
  // makes it back into the SSR cookie jar.
  const { data: { user } } = await supabase.auth.getUser();

  if (user && AUTH_ONLY_ROUTES.has(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // The matcher below lists these routes as protected, but nothing previously
  // enforced that server-side — an unauthenticated request fell straight
  // through to the page (the full shell/JS bundle got served, and only
  // useAuthSession() on the client eventually redirected, up to ~3s later).
  // Enforce it here too, using the same session lookup already done above.
  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/dashboard/:path*",
    "/activity/:path*",
    "/reports/:path*",
    "/pomodoro/:path*",
    "/daily-planner/:path*",
    "/routine-templates/:path*",
    "/admin/:path*",
  ],
};
