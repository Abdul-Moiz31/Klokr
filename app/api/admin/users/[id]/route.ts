import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { cookies } from "next/headers";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  return (
    !!token &&
    !!process.env.ADMIN_SESSION_SECRET &&
    token === process.env.ADMIN_SESSION_SECRET
  );
}

// PATCH /api/admin/users/[id]
// body: { email?, name?, banned? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as { email?: string; name?: string; banned?: boolean };
  const admin = createAdminClient();

  // Fetch current user so we can safely merge metadata instead of overwriting
  const { data: current, error: fetchErr } = await admin.auth.admin.getUserById(id);
  if (fetchErr || !current.user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.email === "string" && body.email.trim()) {
    updates.email = body.email.trim();
  }

  if (typeof body.name === "string") {
    // Merge into existing user_metadata so OAuth fields (avatar_url etc.) are preserved
    updates.user_metadata = {
      ...(current.user.user_metadata ?? {}),
      full_name: body.name,
    };
  }

  if (typeof body.banned === "boolean") {
    updates.ban_duration = body.banned ? "876000h" : "none";
    // Write to app_metadata so the client can detect restriction status
    updates.app_metadata = {
      ...(current.user.app_metadata ?? {}),
      restricted: body.banned,
    };
  }

  const { data, error } = await admin.auth.admin.updateUserById(id, updates);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data.user });
}

// DELETE /api/admin/users/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  // Delete session data first (no cascade FK on tab_sessions)
  await admin.from("tab_sessions").delete().eq("user_id", id);
  // user_planner_data has ON DELETE CASCADE but belt-and-suspenders:
  await admin.from("user_planner_data").delete().eq("user_id", id);

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
