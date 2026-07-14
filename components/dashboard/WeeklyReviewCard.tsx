"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { loadPrefs } from "@/lib/prefs";
import { getSiteName } from "@/lib/domain";
import { useTabSessionsLive } from "@/lib/hooks/useTabSessionsLive";

type Props = {
  userId: string | null;
};

type Review = {
  thisWeekSeconds: number;
  lastWeekSeconds: number;
  deltaPct: number | null;
  productiveDays: number;
  topDomain: string | null;
  goalHours: number;
};

function localDateStr(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/** Monday-start of the week containing `d` (local). */
function getMonday(d: Date): Date {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = base.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  return base;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function fmt(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function WeeklyReviewCard({ userId }: Props) {
  const [review, setReview] = useState<Review | null>(null);
  const prefs = useMemo(() => loadPrefs(), []);
  const liveTick = useTabSessionsLive(userId);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const today = new Date();
      const thisMonday = getMonday(today);
      const lastMonday = addDays(thisMonday, -7);
      const thisSunday = addDays(thisMonday, 6);

      const supabase = createClient();
      const { data } = await supabase
        .from("tab_sessions")
        .select("date, domain, duration_seconds")
        .eq("user_id", userId)
        .gte("date", localDateStr(lastMonday))
        .lte("date", localDateStr(thisSunday));

      if (cancelled || !data) return;

      const thisStart = localDateStr(thisMonday);
      const lastStart = localDateStr(lastMonday);
      const lastEnd = localDateStr(addDays(lastMonday, 6));

      let thisWeekSeconds = 0;
      let lastWeekSeconds = 0;
      const thisWeekByDay = new Map<string, number>();
      const thisWeekByDomain = new Map<string, number>();

      for (const r of data) {
        if (r.date >= thisStart) {
          thisWeekSeconds += r.duration_seconds;
          thisWeekByDay.set(r.date, (thisWeekByDay.get(r.date) ?? 0) + r.duration_seconds);
          thisWeekByDomain.set(r.domain, (thisWeekByDomain.get(r.domain) ?? 0) + r.duration_seconds);
        } else if (r.date >= lastStart && r.date <= lastEnd) {
          lastWeekSeconds += r.duration_seconds;
        }
      }

      const thresholdS = prefs.productiveHoursThreshold * 3600;
      let productiveDays = 0;
      for (const s of thisWeekByDay.values()) if (s >= thresholdS) productiveDays++;

      let topDomain: string | null = null;
      let topSeconds = 0;
      for (const [domain, s] of thisWeekByDomain) {
        if (s > topSeconds) { topSeconds = s; topDomain = domain; }
      }

      const deltaPct =
        lastWeekSeconds > 0
          ? Math.round(((thisWeekSeconds - lastWeekSeconds) / lastWeekSeconds) * 100)
          : null;

      setReview({
        thisWeekSeconds,
        lastWeekSeconds,
        deltaPct,
        productiveDays,
        topDomain,
        goalHours: prefs.productiveHoursThreshold,
      });
    })();

    return () => { cancelled = true; };
  }, [userId, prefs, liveTick]);

  // Hide until there's something to say.
  if (!review || review.thisWeekSeconds === 0) return null;

  const up = review.deltaPct != null && review.deltaPct > 0;
  const down = review.deltaPct != null && review.deltaPct < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex h-full flex-col rounded-xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.06] to-cyan-500/[0.04] px-4 py-4"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-white/85">This week so far</h3>
        </div>
        <Link href="/reports" className="text-xs text-white/35 transition hover:text-white/65">
          Full reports →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xl font-bold tabular-nums text-white">{fmt(review.thisWeekSeconds)}</p>
          <p className="mt-0.5 text-xs text-white/40">tracked this week</p>
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums text-emerald-300">{review.productiveDays}</p>
          <p className="mt-0.5 text-xs text-white/40">productive {review.productiveDays === 1 ? "day" : "days"} ({review.goalHours}h+)</p>
        </div>
        <div>
          <p className="truncate text-xl font-bold text-violet-200">{review.topDomain ? getSiteName(review.topDomain) : "—"}</p>
          <p className="mt-0.5 text-xs text-white/40">top site</p>
        </div>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-white/50">
        {review.deltaPct == null ? (
          <>First full week of tracking — next week you&apos;ll see how you compare.</>
        ) : up ? (
          <>You&apos;re up <b className="text-emerald-300">{review.deltaPct}%</b> vs last week ({fmt(review.lastWeekSeconds)}). Strong momentum.</>
        ) : down ? (
          <>You&apos;re down <b className="text-amber-300">{Math.abs(review.deltaPct)}%</b> vs last week ({fmt(review.lastWeekSeconds)}). A lighter week — that&apos;s okay.</>
        ) : (
          <>Right on pace with last week ({fmt(review.lastWeekSeconds)}).</>
        )}
      </p>
    </motion.div>
  );
}
