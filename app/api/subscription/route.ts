import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";
import { getUserSubscription } from "@/lib/subscription";

// Returns the caller's current plan/subscription so the UI can render the
// correct billing state. Safe when billing isn't set up — returns free tier.
export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseForUserJwt(token);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await getUserSubscription(supabase, user.id);
  return NextResponse.json({ subscription });
}
