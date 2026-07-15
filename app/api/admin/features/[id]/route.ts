import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-auth";

async function verifyAdmin() {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
}

// PATCH — toggle enabled or update name/description
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { enabled?: boolean; name?: string; description?: string; feature_key?: string };
  const admin = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();
  if (typeof body.feature_key === "string") updates.feature_key = body.feature_key.trim() || null;

  const { data, error } = await admin
    .from("feature_flags")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ feature: data });
}

// DELETE — remove a feature
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  const { error } = await admin.from("feature_flags").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
