import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { cookies } from "next/headers";

async function verifyAdmin() {
  const store = await cookies();
  const token = store.get("admin_session")?.value;
  return !!token && !!process.env.ADMIN_SESSION_SECRET && token === process.env.ADMIN_SESSION_SECRET;
}

// POST — create a new feature
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tier, name, description, feature_key } = await req.json() as {
    tier: string; name: string; description?: string; feature_key?: string;
  };

  if (!tier || !name?.trim()) {
    return NextResponse.json({ error: "tier and name are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feature_flags")
    .insert({
      tier,
      name: name.trim(),
      description: description?.trim() ?? "",
      // Optional machine key used for in-product gating. Blank → display-only.
      feature_key: feature_key?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ feature: data });
}
