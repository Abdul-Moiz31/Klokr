"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { loadPrefs } from "@/lib/prefs";
import { computeProgress, localDateStr, type ProgressResult } from "@/lib/gamification";
import { useTabSessionsLive } from "@/lib/hooks/useTabSessionsLive";

type Props = { userId: string | null };

function scoreColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 40) return "#7C3AED";
  return "#F59E0B";
}

// Compact gamification headline for the top of the dashboard: today's
// accountability score, current level + XP, and the loss-aversion streak.
// Self-contained (fetches its own 90-day window) to match the other
// dashboard insight cards. Full detail lives on /progress.
export function AccountabilityCard({ userId }: Props) {
  const [result, setResult] = useState<ProgressResult | null>(null);
  const prefs = useMemo(() => loadPrefs(), []);
  const liveTick = useTabSessionsLive(userId);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const today = new Date();
      const todayStr = localDateStr(today);
      const from = new Date(today);
      from.setDate(today.getDate() - 90);

      const supabase = createClient();
      const { data } = await supabase
        .from("tab_sessions")
        .select("domain, duration_seconds, date")
        .eq("user_id", userId)
        .gte("date", localDateStr(from))
        .lte("date", todayStr)
        .gte("duration_seconds", prefs.minSessionSeconds);

      if (cancelled || !data) return;
      setResult(
        computeProgress(data as Array<{ domain: string; duration_seconds: number; date: string }>, {
          overrides: prefs.categoryOverrides,
          goalHours: prefs.productiveHoursThreshold,
          todayStr,
        })
      );
    })();
    return () => { cancelled = true; };
  }, [userId, prefs, liveTick]);

  if (!result) return null;

  const { today, level, currentStreak, streakAtRisk } = result;
  const color = scoreColor(today.score);
  const R = 26, C = 2 * Math.PI * R, dash = (today.score / 100) * C;
  const hotStreak = currentStreak >= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-r from-violet-500/[0.07] via-white/[0.02] to-cyan-500/[0.04]"
    >
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          {/* Score gauge */}
          <div className="flex items-center gap-3">
            <div className="relative h-[68px] w-[68px] shrink-0">
              <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
                <circle cx="34" cy="34" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <motion.circle
                  cx="34" cy="34" r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
                  initial={{ strokeDasharray: `0 ${C}` }}
                  animate={{ strokeDasharray: `${dash} ${C}` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black tabular-nums text-white">{today.score}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white/85">Accountability</p>
              <p className="text-xs" style={{ color }}>{today.label}</p>
            </div>
          </div>

          <div className="hidden h-9 w-px bg-white/[0.08] sm:block" />

          {/* Level + XP */}
          <div className="min-w-[150px]">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-violet-500/30 bg-violet-600/20 text-[11px] font-bold text-violet-200">
                {level.level}
              </span>
              <span className="text-sm font-semibold text-white/80">{level.name}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${level.progressPct}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-white/35 tabular-nums">
              {level.isMax ? "Max level" : `${level.xpToNext?.toLocaleString()} XP to ${level.nextName}`}
            </p>
          </div>

          <div className="hidden h-9 w-px bg-white/[0.08] sm:block" />

          {/* Streak */}
          <div className="flex items-center gap-2.5">
            <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${hotStreak ? "bg-orange-500/15 text-orange-300" : "bg-violet-500/15 text-violet-300"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <div>
              <p className="text-base font-bold leading-none text-white tabular-nums">
                {currentStreak}<span className="ml-0.5 text-xs font-medium text-white/40">d</span>
              </p>
              <p className={`mt-0.5 text-[11px] ${streakAtRisk ? "text-amber-300/90" : "text-white/40"}`}>
                {streakAtRisk ? "at risk today" : "streak"}
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/progress"
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/60 transition hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-200 sm:self-auto"
        >
          View progress
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </motion.div>
  );
}
