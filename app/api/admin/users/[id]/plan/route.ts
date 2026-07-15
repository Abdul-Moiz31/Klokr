import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-auth";

async function verifyAdmin() {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
}

const VALID: ReadonlySet<string> = new Set(["free", "standard", "pro"]);

// POST /api/admin/users/[id]/plan
// body: { plan: "free" | "standard" | "pro" | null, note?: string }
// Sets (or clears, with null) a MANUAL plan grant on the user's subscription
// row. Manual grants win over Stripe and are never billed. Upserts so a user
// who never touched Stripe still gets a row.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { plan?: string | null; note?: string };
  try { body = (await req.json()) as { plan?: string | null; note?: string }; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const plan = body.plan ?? null;
  if (plan !== null && !VALID.has(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: id,
        // null clears the grant (user falls back to their Stripe plan / free).
        manual_plan: plan,
        manual_plan_note: plan ? (body.note?.trim() || "Granted by admin") : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, manual_plan: plan });
}
