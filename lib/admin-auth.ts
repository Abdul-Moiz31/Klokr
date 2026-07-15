import { randomBytes, createHash } from "crypto";
import { createAdminClient } from "./supabase-admin";

// Real per-login admin sessions (migration 017) — replaces the old model of
// setting the cookie to the literal ADMIN_SESSION_SECRET env var, which
// meant every login produced the same token, unrevoked, with no real expiry.
export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — matches the old cookie maxAge

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a new session, returns the raw token to set as the cookie value. */
export async function createAdminSession(): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const admin = createAdminClient();
  const { error } = await admin
    .from("admin_sessions")
    .insert({ token_hash: hashToken(token), expires_at: expiresAt.toISOString() });
  if (error) throw new Error(`Failed to create admin session: ${error.message}`);
  return { token, expiresAt };
}

/** True if `token` is a live, unexpired session — the single check every admin route should use. */
export async function verifyAdminSession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_sessions")
    .select("expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data) return false;
  return new Date(data.expires_at as string).getTime() > Date.now();
}

/** Revokes a session immediately (logout) — this is what makes revocation possible at all. */
export async function revokeAdminSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  const admin = createAdminClient();
  await admin.from("admin_sessions").delete().eq("token_hash", hashToken(token));
}
