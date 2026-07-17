"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { loadPrefs, getLocalDateString, getLocalHour, addDaysToDateString } from "@/lib/prefs";
import {
  fetchNotifications,
  generateNotifications,
  generateNudge,
  markAllRead,
  markRead,
  dismiss,
  type AppNotification,
  type NotificationType,
} from "@/lib/notifications";

type Props = { userId: string | null };

const ICON: Record<NotificationType, string> = {
  streak_milestone: "🔥",
  goal_hit: "✓",
  weekly_review: "📊",
  nudge: "👋",
  info: "•",
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Fire OS/browser notifications for freshly-created items, if the user granted
// permission. Best-effort — silently no-ops when unsupported or denied.
//
// generateNotifications()/generateNudge() dedupe at the DB level (unique on
// user_id+dedupe_key, INSERT ... ON CONFLICT DO NOTHING), so two tabs racing
// to generate the same notification only ever get one row actually inserted
// — but that's a per-row guarantee, not a same-millisecond one, and doesn't
// stop a second tab whose own generation call also happens to win a
// different item in the same batch. This localStorage-based lock is a cheap,
// non-atomic (there's a small read-then-write race window, not a true
// mutex) but effective-in-practice belt-and-suspenders: only one tab fires
// native popups within any 5s window, so a user with several tabs open
// doesn't get the same "3-day streak!" toast three times over.
const NOTIF_FIRE_LOCK_KEY = "Klokrs_notif_fire_lock";
const NOTIF_FIRE_LOCK_WINDOW_MS = 5_000;

function claimBrowserNotifLock(): boolean {
  try {
    const now = Date.now();
    const raw = localStorage.getItem(NOTIF_FIRE_LOCK_KEY);
    const last = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isNaN(last) && now - last < NOTIF_FIRE_LOCK_WINDOW_MS) return false;
    localStorage.setItem(NOTIF_FIRE_LOCK_KEY, String(now));
    return true;
  } catch {
    return true; // storage unavailable — fail open, better to double-fire than never fire
  }
}

function fireBrowserNotifs(items: AppNotification[]) {
  if (items.length === 0) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!claimBrowserNotifLock()) return;
  for (const n of items) {
    try {
      new Notification(n.title, { body: n.body, tag: n.dedupe_key, icon: "/icon.svg" });
    } catch { /* ignore */ }
  }
}

export function NotificationBell({ userId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  const refresh = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    setItems(await fetchNotifications(supabase, userId));
  }, [userId]);

  // On mount: generate notifications from the user's data, then load the list.
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const prefs = loadPrefs();
      // Pull last 90 days of tracked totals to derive streak/goal notifications.
      const todayStr = getLocalDateString(prefs);
      const fromStr = addDaysToDateString(todayStr, -90);
      const { data: rows } = await supabase
        .from("tab_sessions")
        .select("date, duration_seconds")
        .eq("user_id", userId)
        .gte("date", fromStr)
        .lte("date", todayStr)
        .gte("duration_seconds", prefs.minSessionSeconds);

      const map = new Map<string, number>();
      for (const r of rows ?? []) map.set(r.date, (map.get(r.date) ?? 0) + r.duration_seconds);

      const goalSeconds = prefs.productiveHoursThreshold * 3600;
      const fresh = [
        ...(await generateNotifications(supabase, userId, map, goalSeconds, todayStr)),
        ...(await generateNudge(supabase, userId, map, todayStr, getLocalHour(prefs))),
      ];
      if (cancelled) return;
      fireBrowserNotifs(fresh);
      await refresh();
    })();

    return () => { cancelled = true; };
  }, [userId, refresh]);

  // Live sync across tabs/devices: a notification generated, marked read, or
  // dismissed elsewhere (another open tab, another device) shows up here
  // without needing a reload — same Realtime + polling-fallback pattern used
  // for tab_sessions elsewhere in the dashboard. The poll only does real work
  // while the realtime channel isn't confirmed healthy — worst case (a
  // blocked websocket, a connection that drops without a clean error) this
  // is identical to always polling; it only becomes a no-op once realtime is
  // genuinely delivering updates, instead of redundantly re-fetching anyway.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications_live:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void refresh()
      );
    let isRealtimeHealthy = false;
    channel.subscribe((status: string) => {
      isRealtimeHealthy = status === "SUBSCRIBED";
    });

    const pollingInterval = setInterval(() => {
      if (isRealtimeHealthy) return;
      void refresh();
    }, 30_000);

    return () => {
      clearInterval(pollingInterval);
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
  };

  const onItemClick = async (n: AppNotification) => {
    if (!n.read) {
      const supabase = createClient();
      await markRead(supabase, n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.href) { setOpen(false); router.push(n.href); }
  };

  const onDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const supabase = createClient();
    await dismiss(supabase, id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const onMarkAllRead = async () => {
    if (!userId) return;
    const supabase = createClient();
    await markAllRead(supabase, userId);
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  if (!userId) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition hover:border-white/20 hover:text-white/90"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-[#0f0f16] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <p className="text-sm font-semibold text-white/85">Notifications</p>
              {unread > 0 && (
                <button onClick={() => void onMarkAllRead()} className="text-xs text-violet-300 hover:text-violet-200">
                  Mark all read
                </button>
              )}
            </div>

            {/* Browser-notification opt-in */}
            {permission === "default" && (
              <button
                onClick={() => void requestPermission()}
                className="flex w-full items-center gap-2 border-b border-white/[0.06] bg-violet-500/[0.06] px-4 py-2.5 text-left text-xs text-violet-200 transition hover:bg-violet-500/10"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /></svg>
                Enable browser notifications for streaks &amp; reminders
              </button>
            )}
            {/* Once denied, there's no JS API to re-prompt — the browser
                permanently suppresses Notification.requestPermission() until
                the user changes it in their own browser settings. A
                clickable button here would just silently do nothing, so
                this is informational only, pointing at where to actually
                fix it, instead of the previous dead end (no messaging at all). */}
            {permission === "denied" && (
              <div className="flex items-start gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-left text-xs text-white/40">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                <span>Browser notifications are blocked. Enable them for this site in your browser&apos;s address-bar settings to get streak &amp; reminder alerts.</span>
              </div>
            )}

            <div className="max-h-[22rem] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-white/30">You&apos;re all caught up.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => void onItemClick(n)}
                    className={`group flex w-full items-start gap-3 border-b border-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.03] ${n.read ? "opacity-60" : ""}`}
                  >
                    <span className="mt-0.5 text-base leading-none">{ICON[n.type] ?? "•"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white/85">{n.title}</span>
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-white/45">{n.body}</span>
                      <span className="mt-1 block text-[10px] text-white/25">{timeAgo(n.created_at)}</span>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => void onDismiss(e, n.id)}
                      className="shrink-0 rounded-md p-1 text-white/20 opacity-0 transition hover:text-white/60 group-hover:opacity-100"
                      aria-label="Dismiss"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
