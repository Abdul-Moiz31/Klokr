import type { SupabaseClient } from "@supabase/supabase-js";
import { calcForgivingStreak } from "@/lib/streak";
import { addDaysToDateString } from "@/lib/prefs";

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
 * todayStr: "today" in the caller's resolved timezone (getLocalDateString(prefs))
 *   — taken as a parameter rather than computed here so this always agrees
 *   with whatever range the caller queried `dailyMap` from; a previous
 *   version derived it independently via a raw `new Date()`, which could
 *   disagree with the caller's own (timezone-resolved) "today" right around
 *   a midnight boundary.
 */
export async function generateNotifications(
  supabase: SupabaseClient,
  userId: string,
  dailyMap: Map<string, number>,
  goalSeconds: number,
  todayStr: string
): Promise<AppNotification[]> {
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

  // 3. Weekly review ready — once per ISO week, on/after Sunday. Parsed as
  // UTC noon so reading the weekday back never reinterprets todayStr against
  // a different zone than the one it was resolved in.
  const weekday = new Date(`${todayStr}T12:00:00Z`).getUTCDay();
  if (weekday === 0) {
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
 *
 * Also fires a distinct "restart" nudge when a streak that existed as of
 * yesterday has just broken — previously the only nudge was "keep an active
 * streak alive", so a user who actually lost their streak got silence at
 * exactly the moment they're most likely to churn instead of re-engage.
 * Deliberately does NOT nudge a user who has simply never tracked anything
 * (fs.count === 0 with no streak yesterday either) — that would be an
 * unearned, confusing "restart" prompt for someone who never started.
 *
 * todayStr/localHour: "today" and the current hour in the caller's resolved
 *   timezone (getLocalDateString(prefs)/getLocalHour(prefs)) — see
 *   generateNotifications() above for why these are parameters, not computed
 *   from a raw `new Date()` here.
 */
export async function generateNudge(
  supabase: SupabaseClient,
  userId: string,
  dailyMap: Map<string, number>,
  todayStr: string,
  localHour: number
): Promise<AppNotification[]> {
  const trackedToday = (dailyMap.get(todayStr) ?? 0) > 0;
  if (localHour < 12 || trackedToday) return [];

  const fs = calcForgivingStreak(dailyMap, todayStr);
  if (fs.count > 0) {
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

  const yesterdayStr = addDaysToDateString(todayStr, -1);
  const hadStreakYesterday = calcForgivingStreak(dailyMap, yesterdayStr).count > 0;
  if (hadStreakYesterday) {
    return insertNew(supabase, userId, [
      {
        type: "nudge",
        title: "Start a new streak today",
        body: "Your streak reset — every streak starts with day one. Track something today to get going again.",
        href: "/daily-planner",
        dedupe_key: `nudge_restart_${todayStr}`,
      },
    ]);
  }

  return [];
}
