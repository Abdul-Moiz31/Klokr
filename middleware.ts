import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ONLY_ROUTES = new Set(["/login", "/signup"]);

export async function middleware(request: NextRequest) {
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
