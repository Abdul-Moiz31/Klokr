import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token || token !== process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { olderThanDays } = await req.json() as { olderThanDays: number };
  if (!olderThanDays || olderThanDays < 30) {
    return NextResponse.json({ error: "Must be at least 30 days." }, { status: 400 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const admin = createAdminClient();
  const { count, error } = await admin
    .from("tab_sessions")
    .delete({ count: "exact" })
    .lt("date", cutoffStr);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: count ?? 0 });
}
