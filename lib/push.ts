import webpush from "web-push";
import { createAdminClient } from "./supabase-admin";

export type PushPayload = {
  title: string;
  body: string;
  /** In-app path to open on click, e.g. "/dashboard". Defaults to "/dashboard". */
  url?: string;
  /** Used as the browser Notification's tag — a second push with the same
   *  tag replaces the first instead of stacking. */
  tag?: string;
};

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@klokrs.com";
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Sends a push notification to every device the user has subscribed on.
 * Best-effort per subscription — one dead endpoint doesn't block the others.
 * A 404/410 from the push service means the subscription is gone (browser
 * unsubscribed, permission revoked, endpoint expired) and is cleaned up
 * automatically rather than retried forever.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return; // VAPID not configured — no-op, not an error
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return;

  const body = JSON.stringify({ url: "/dashboard", ...payload });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id as string);
        }
        // Other errors (transient 5xx from the push service, etc.) are left
        // as-is — the next real event will just try again on its own.
      }
    })
  );
}

/** True if this push send would actually reach anyone right now, without sending. */
export function isPushConfigured(): boolean {
  return ensureConfigured();
}
