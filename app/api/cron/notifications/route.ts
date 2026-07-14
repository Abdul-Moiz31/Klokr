import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendPushToUser } from "@/lib/push";
import { localClockForZone } from "@/lib/timezone";
import { migrateAnyToV5 } from "@/lib/daily-planner/storage";
import { DEFAULT_PREFS, type KlokrsPrefs } from "@/lib/prefs";
import type { PlannerTask } from "@/lib/daily-planner/types";

// Server-side counterpart to the extension's day-start/day-complete/task-
// started/task-ending-soon notifications (background.js). Exists because
// neither the extension's chrome.notifications nor the website's in-app
// bell can reach a user with no browser window open at all — this runs on a
// schedule (see vercel.json) regardless of whether anyone's browser is open,
// and only ever targets users who've actually enabled push (see
// push_subscriptions / Settings → Notifications → Push notifications).
//
// Known limitation: a user whose prefs.timezone is still null (never set —
// the extension/website normally auto-detects it from the browser) can't be
// scheduled correctly server-side, since there's no browser here to infer a
// default from. Those users are skipped for schedule-based push; their
// extension-side local notifications are unaffected.

export const maxDuration = 60;

type Prefs = KlokrsPrefs;

function isInsideWorkWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

async function alreadySent(admin: ReturnType<typeof createAdminClient>, userId: string, dedupeKey: string): Promise<boolean> {
  const { data } = await admin
    .from("push_notification_log")
    .select("dedupe_key")
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  return Boolean(data);
}

async function markSent(admin: ReturnType<typeof createAdminClient>, userId: string, dedupeKey: string): Promise<void> {
  await admin.from("push_notification_log").upsert(
    { user_id: userId, dedupe_key: dedupeKey },
    { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
  );
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Only users who could actually receive a push are worth computing for.
  const { data: subRows } = await admin.from("push_subscriptions").select("user_id");
  const userIds = [...new Set((subRows ?? []).map((r) => r.user_id as string))];
  if (userIds.length === 0) return NextResponse.json({ checked: 0 });

  let notified = 0;

  for (const userId of userIds) {
    try {
      const [{ data: prefRow }, { data: plannerRow }] = await Promise.all([
        admin.from("user_preferences").select("prefs").eq("user_id", userId).maybeSingle(),
        admin.from("user_planner_data").select("data").eq("user_id", userId).maybeSingle(),
      ]);

      const prefs: Prefs = { ...DEFAULT_PREFS, ...(prefRow?.prefs as Partial<Prefs> | undefined) };
      if (!prefs.timezone) continue; // can't reliably compute their local day — see file doc comment

      const { hour, minutes: nowMinutes, dateKey } = localClockForZone(prefs.timezone);
      const n = prefs.notifications;

      // Day start / day complete — mirrors background.js's checkWorkWindowTransition().
      const inside = isInsideWorkWindow(hour, prefs.workStartHour, prefs.workEndHour);
      if (inside && n.dayStart) {
        const key = `day_start_${dateKey}`;
        if (!(await alreadySent(admin, userId, key))) {
          await sendPushToUser(userId, {
            title: "Day started",
            body: `Klokrs is tracking your tab time until ${String(prefs.workEndHour).padStart(2, "0")}:00.`,
            url: "/dashboard",
            tag: key,
          });
          await markSent(admin, userId, key);
          notified++;
        }
      }
      if (!inside && n.dayComplete && prefs.workStartHour !== prefs.workEndHour) {
        const key = `day_complete_${dateKey}`;
        // Only if today's day-start already fired — don't notify "complete"
        // for a day the user was never inside the window for.
        if ((await alreadySent(admin, userId, `day_start_${dateKey}`)) && !(await alreadySent(admin, userId, key))) {
          await sendPushToUser(userId, {
            title: "Day complete",
            body: "Your work day is wrapped. Open the dashboard for a recap.",
            url: "/dashboard",
            tag: key,
          });
          await markSent(admin, userId, key);
          notified++;
        }
      }

      // Task started / task ending soon — mirrors checkTaskNotifications().
      if ((n.taskStarted || n.taskEndingSoon) && plannerRow?.data) {
        const state = migrateAnyToV5(plannerRow.data);
        const today = state.adHocByDate[dateKey];
        const tasks: PlannerTask[] = (today?.tasks ?? []).filter(
          (t) => t.startMinutes != null && t.endMinutes != null
        );

        for (const t of tasks) {
          const start = t.startMinutes as number;
          const end = t.endMinutes as number;
          const title = t.title || "Task";

          if (n.taskStarted && nowMinutes >= start && nowMinutes < end) {
            const key = `task_start_${t.id}_${dateKey}`;
            if (!(await alreadySent(admin, userId, key))) {
              await sendPushToUser(userId, {
                title: "Task started",
                body: `${title} has started.`,
                url: "/daily-planner",
                tag: key,
              });
              await markSent(admin, userId, key);
              notified++;
            }
          }

          const remaining = end - nowMinutes;
          if (n.taskEndingSoon && remaining > 0 && remaining <= 5) {
            const key = `task_ending_${t.id}_${dateKey}`;
            if (!(await alreadySent(admin, userId, key))) {
              const mins = Math.max(1, Math.round(remaining));
              await sendPushToUser(userId, {
                title: "Task ending soon",
                body: `${title} ends in ${mins} minute${mins === 1 ? "" : "s"}.`,
                url: "/daily-planner",
                tag: key,
              });
              await markSent(admin, userId, key);
              notified++;
            }
          }
        }
      }
    } catch {
      // One user's bad data shouldn't stop the batch — move on.
      continue;
    }
  }

  return NextResponse.json({ checked: userIds.length, notified });
}
