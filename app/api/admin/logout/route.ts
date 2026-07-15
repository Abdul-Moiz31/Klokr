import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, revokeAdminSession } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  // Actually revokes the session server-side, not just clearing the cookie —
  // with the old static-secret model this was pointless (the "session" was
  // the env var itself, which logout could never invalidate); now it matters.
  await revokeAdminSession(token);

  const origin = req.nextUrl.origin;
  const res = NextResponse.redirect(`${origin}/admin/login`);
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return res;
}
