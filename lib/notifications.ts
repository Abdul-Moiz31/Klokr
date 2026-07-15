import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateStr, calcForgivingStreak } from "@/lib/streak";

export type NotificationType =
  | "streak_milestone"
  | "goal_hit"
  | "weekly_review"
  | "nudge"
  | "info";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  dedupe_key: string;
  read: boolean;
  created_at: string;
};

type NewNotification = {
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  dedupe_key: string;
};

const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

// ── Read / mutate ───────────────────────────────────────────────────────────

export async function fetchNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 30
): Promise<AppNotification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, href, dedupe_key, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as AppNotification[] | null) ?? [];
}

export async function markRead(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function markAllRead(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}

export async function dismiss(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from("notifications").delete().eq("id", id);
}

// Insert notifications, ignoring duplicates (unique on user_id+dedupe_key).
// Returns the rows that were actually newly created (for browser-notif firing).
async function insertNew(
  supabase: SupabaseClient,
  userId: string,
  items: NewNotification[]
): Promise<AppNotification[]> {
  if (items.length === 0) return [];
  const { data } = await supabase
    .from("notifications")
    .upsert(
      items.map((n) => ({ ...n, user_id: userId, href: n.href ?? null })),
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
    )
    .select("id, type, title, body, href, dedupe_key, read, created_at");
  const created = (data as AppNotification[] | null) ?? [];
  if (created.length > 0) void pushNewly(supabase, created);
  return created;
}

// Best-effort Web Push for freshly-created notifications, so a device that
// isn't the one currently generating them (browser closed, another tab, a
// different device on the same account) still gets notified — the in-app
// bell alone only shows what's already loaded in an open tab. Fire-and-
// forget: this generation still ran and the notification is already
// persisted even if the push itself fails (offline, no subscription, etc).
async function pushNewly(supabase: SupabaseClient, items: AppNotification[]): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    await fetch("/api/push/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        notifications: items.map((n) => ({
          title: n.title,
          body: n.body,
          url: n.href ?? "/dashboard",
          tag: n.dedupe_key,
        })),
      }),
    });
  } catch {
    // Offline / no subscription / server hiccup — the notification itself
    // already made it into the DB and the in-app bell; push is a bonus.
  }
}

// ── Generation ──────────────────────────────────────────────────────────────

/**
 * Derive notifications from the user's own data. Idempotent via dedupe_key, so
 * it's safe to call on every dashboard load. Returns newly-created rows.
 *
 * dailyMap: date-string → tracked seconds (last 90 days)
 * goalSeconds: the user's productive-hours goal in seconds
 */
export async function generateNotifications(
  supabase: SupabaseClient,
  userId: string,
  dailyMap: Map<string, number>,
  goalSeconds: number
): Promise<AppNotification[]> {
  const todayStr = localDateStr(new Date());
  const items: NewNotification[] = [];

  // 1. Streak milestone — fire once per milestone value reached.
  const fs = calcForgivingStreak(dailyMap, todayStr);
  const milestone = STREAK_MILESTONES.filter((m) => fs.count >= m).pop();
  if (milestone) {
    items.push({
      type: "streak_milestone",
      title: `${milestone}-day streak! 🔥`,
      body: `You've shown up ${milestone} days running. Keep the momentum going.`,
      href: "/activity",
      // Dedupe by milestone only (not date) so it fires exactly once ever.
      dedupe_key: `streak_${milestone}`,
    });
  }

  // 2. Goal hit today — once per day.
  if ((dailyMap.get(todayStr) ?? 0) >= goalSeconds && goalSeconds > 0) {
    items.push({
      type: "goal_hit",
      title: "Daily goal reached ✓",
      body: "You hit your focus goal today. Nice work.",
      href: "/dashboard",
      dedupe_key: `goal_${todayStr}`,
    });
  }

  // 3. Weekly review ready — once per ISO week, on/after Sunday.
  const now = new Date();
  if (now.getDay() === 0) {
    const weekKey = todayStr; // the Sunday date identifies the week
    items.push({
      type: "weekly_review",
      title: "Your week in review is ready",
      body: "See how this week compared to last — and what to focus on next.",
      href: "/reports",
      dedupe_key: `weekly_${weekKey}`,
    });
  }

  return insertNew(supabase, userId, items);
}

/**
 * Accountability nudge: if the user has an active streak but hasn't tracked
 * anything yet today (and it's past midday), gently remind them. Once per day.
 */
export async function generateNudge(
  supabase: SupabaseClient,
  userId: string,
  dailyMap: Map<string, number>
): Promise<AppNotification[]> {
  const todayStr = localDateStr(new Date());
  const hour = new Date().getHours();
  const trackedToday = (dailyMap.get(todayStr) ?? 0) > 0;
  const fs = calcForgivingStreak(dailyMap, todayStr);

  // Only nudge if: past midday, nothing tracked today, and a streak is at stake.
  if (hour >= 12 && !trackedToday && fs.count > 0) {
    return insertNew(supabase, userId, [
      {
        type: "nudge",
        title: fs.atRisk ? "Your streak needs you today" : "Keep your streak alive",
        body: `You're on a ${fs.count}-day streak. A little focused time today keeps it going.`,
        href: "/daily-planner",
        dedupe_key: `nudge_${todayStr}`,
      },
    ]);
  }
  return [];
}
