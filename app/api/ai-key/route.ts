import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForUserJwt } from "@/lib/supabase-user-client";
import { createAdminClient } from "@/lib/supabase-admin";
import { encryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { getQuotaStatus } from "@/lib/ai-quota";

// Manage the user's bring-your-own-key (BYOK) provider key + report AI quota.
// The plaintext key is accepted on POST, encrypted at rest, and NEVER returned.

async function authed(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const supabase = createSupabaseForUserJwt(token);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { supabase, user };
}

// GET — key presence (never the key itself) + current quota status.
export async function GET(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await ctx.supabase
    .from("ai_keys")
    .select("provider, encrypted_key")
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  const hasOwnKey = Boolean(data?.encrypted_key);
  const quota = await getQuotaStatus(ctx.supabase, ctx.user.id, hasOwnKey);

  return NextResponse.json({
    hasOwnKey,
    provider: (data?.provider as string | undefined) ?? "anthropic",
    quota,
  });
}

// POST — save/replace the user's key. body: { provider, key }
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      { error: "Key storage is not configured on this server." },
      { status: 503 }
    );
  }

  let body: { provider?: string; key?: string };
  try { body = (await req.json()) as { provider?: string; key?: string }; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const SUPPORTED_PROVIDERS = ["anthropic", "openai", "gemini", "openrouter", "groq"] as const;
  type Provider = typeof SUPPORTED_PROVIDERS[number];
  const provider = (body.provider ?? "anthropic") as Provider;
  const key = (body.key ?? "").trim();
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
  }
  if (!key || key.length < 10) {
    return NextResponse.json({ error: "Enter a valid API key." }, { status: 400 });
  }

  const encrypted = encryptSecret(key);
  if (!encrypted) return NextResponse.json({ error: "Encryption failed." }, { status: 500 });

  const admin = createAdminClient();
  const { error } = await admin.from("ai_keys").upsert(
    { user_id: ctx.user.id, provider, encrypted_key: encrypted, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, hasOwnKey: true, provider });
}

// DELETE — remove the user's key (revert to metered quota).
export async function DELETE(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from("ai_keys").delete().eq("user_id", ctx.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, hasOwnKey: false });
}
