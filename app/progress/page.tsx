"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthSession } from "@/lib/useAuthSession";
import { createClient } from "@/lib/supabase";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Loader } from "@/components/ui/Loader";
import { loadPrefs } from "@/lib/prefs";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import {
  computeProgress,
  fmtHm,
  localDateStr,
  type ProgressResult,
  type Badge,
} from "@/lib/gamification";

/* ── Accountability score gauge ───────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 40) return "#7C3AED";
  return "#F59E0B";
}

function ScoreHero({ p }: { p: ProgressResult }) {
  const { today } = p;
  const color = scoreColor(today.score);
  const R = 52, C = 2 * Math.PI * R;
  const dash = (today.score / 100) * C;

  const bars: { label: string; value: number; weight: string }[] = [
    { label: "Goal time",       value: today.breakdown.goal,           weight: "35%" },
    { label: "Deep work",       value: today.breakdown.deepWork,       weight: "30%" },
    { label: "Low distraction", value: today.breakdown.lowDistraction, weight: "25%" },
    { label: "Streak",          value: today.breakdown.streak,         weight: "10%" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.07] via-white/[0.02] to-cyan-500/[0.04] p-6 sm:p-7"
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
        {/* Gauge */}
        <div className="relative h-[140px] w-[140px] shrink-0">
          <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
            <motion.circle
              cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${C}` }}
              animate={{ strokeDasharray: `${dash} ${C}` }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black tabular-nums text-white">{today.score}</span>
            <span className="text-[10px] uppercase tracking-widest text-white/35">/ 100</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-bold text-white/95">Today&apos;s accountability</h2>
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ color, borderColor: `${color}55`, background: `${color}18` }}>
              {today.label}
            </span>
          </div>
          <p className="mb-4 text-xs text-white/40">
            {today.totalSeconds > 0
              ? `${fmtHm(today.totalSeconds)} tracked · ${fmtHm(today.deepSeconds)} deep work`
              : "No tracked time yet today — start browsing to build your score."}
          </p>

          <div className="space-y-2.5">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-white/50">{b.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${b.value}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: color }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-white/40">{b.value}</span>
                <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-white/25">{b.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Level + XP ───────────────────────────────────────────── */

function LevelCard({ p }: { p: ProgressResult }) {
  const { level } = p;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-600/30 to-cyan-600/20 text-lg font-black text-white shadow-lg shadow-violet-900/30">
            {level.level}
          </div>
          <div>
            <p className="text-base font-bold text-white/95">{level.name}</p>
            <p className="text-xs text-white/40">{level.totalXp.toLocaleString()} XP total</p>
          </div>
        </div>
        {!level.isMax ? (
          <div className="text-right">
            <p className="text-xs text-white/35">Next: {level.nextName}</p>
            <p className="text-sm font-semibold text-violet-300 tabular-nums">{level.xpToNext?.toLocaleString()} XP to go</p>
          </div>
        ) : (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">Max level</span>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[11px] text-white/35">
          <span>Level {level.level}</span>
          {!level.isMax && <span>Level {level.level + 1}</span>}
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${level.progressPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-white/30">
        XP is earned per minute, weighted by category — Deep Work earns 3×, Productivity 2×, and pure distractions earn nothing.
      </p>
    </motion.div>
  );
}

/* ── Streak (loss-aversion) ───────────────────────────────── */

function StreakCard({ p }: { p: ProgressResult }) {
  const hot = p.currentStreak >= 7;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`rounded-2xl border p-6 ${p.streakAtRisk ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-white/[0.08] bg-white/[0.03]"}`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${hot ? "bg-orange-500/15 text-orange-300" : "bg-violet-500/15 text-violet-300"}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </span>
        <div>
          <p className="text-2xl font-black leading-none text-white tabular-nums">
            {p.currentStreak}<span className="ml-1 text-sm font-medium text-white/40">day{p.currentStreak === 1 ? "" : "s"}</span>
          </p>
          <p className={`mt-1 text-xs ${p.streakAtRisk ? "text-amber-300/90" : "text-white/40"}`}>
            {p.currentStreak === 0
              ? "Start your streak today"
              : p.streakAtRisk
                ? "⚠ Browse today or you'll lose it"
                : p.graceUsed
                  ? "Current streak · 1 day forgiven"
                  : "Current streak"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="text-xs text-white/40">Longest ever</span>
        <span className="text-sm font-bold text-white tabular-nums">{p.records.longestStreakDays} days</span>
      </div>
    </motion.div>
  );
}

/* ── Records ──────────────────────────────────────────────── */

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RecordsCard({ p }: { p: ProgressResult }) {
  const recs = [
    { label: "Best deep-work day", value: fmtHm(p.records.bestDeepDaySeconds), sub: fmtDate(p.records.bestDeepDayDate) },
    { label: "Best score",         value: `${p.records.bestScore}`,            sub: fmtDate(p.records.bestScoreDate) },
    { label: "Most tracked day",   value: fmtHm(p.records.bestTotalDaySeconds), sub: fmtDate(p.records.bestTotalDayDate) },
    { label: "Longest streak",     value: `${p.records.longestStreakDays}d`,    sub: "all time" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6"
    >
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-white/30">Personal records</p>
      <div className="grid grid-cols-2 gap-4">
        {recs.map((r) => (
          <div key={r.label}>
            <p className="text-xl font-black text-white tabular-nums">{r.value}</p>
            <p className="text-xs text-white/55">{r.label}</p>
            <p className="text-[10px] text-white/25">{r.sub}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Category XP breakdown ────────────────────────────────── */

function CategoryCard({ p }: { p: ProgressResult }) {
  const entries = (Object.keys(p.categoryTotals) as CategoryId[])
    .map((id) => ({ id, seconds: p.categoryTotals[id] }))
    .filter((e) => e.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
  const total = entries.reduce((s, e) => s + e.seconds, 0) || 1;

  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6"
    >
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-white/30">Where your time went (90 days)</p>
      {/* Stacked bar */}
      <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full">
        {entries.map((e) => (
          <div key={e.id} style={{ width: `${(e.seconds / total) * 100}%`, background: CATEGORIES[e.id].color }} title={CATEGORIES[e.id].label} />
        ))}
      </div>
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CATEGORIES[e.id].color }} />
            <span className="flex-1 text-sm text-white/70">{CATEGORIES[e.id].label}</span>
            <span className="text-xs text-white/40 tabular-nums">{Math.round((e.seconds / total) * 100)}%</span>
            <span className="w-16 text-right text-sm font-medium text-white/80 tabular-nums">{fmtHm(e.seconds)}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Badges ───────────────────────────────────────────────── */

const TIER_STYLE: Record<string, { ring: string; bg: string; text: string }> = {
  bronze:   { ring: "border-amber-700/40",   bg: "bg-amber-700/10",   text: "text-amber-500" },
  silver:   { ring: "border-slate-400/40",   bg: "bg-slate-400/10",   text: "text-slate-300" },
  gold:     { ring: "border-yellow-500/40",  bg: "bg-yellow-500/10",  text: "text-yellow-400" },
  platinum: { ring: "border-cyan-400/40",    bg: "bg-cyan-400/10",    text: "text-cyan-300" },
};

function BadgeTile({ b, i }: { b: Badge; i: number }) {
  const style = TIER_STYLE[b.tier]!;
  const pct = b.progress ? Math.min(100, Math.round((b.progress.current / b.progress.target) * 100)) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.25 + i * 0.04 }}
      className={`relative rounded-2xl border p-4 transition-all ${b.earned ? `${style.ring} ${style.bg}` : "border-white/[0.06] bg-white/[0.02]"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${b.earned ? `${style.ring} ${style.bg} ${style.text}` : "border-white/10 bg-white/[0.04] text-white/25"}`}>
          {b.earned ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="6" /><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          )}
        </span>
        <span className={`text-[9px] font-bold uppercase tracking-wider ${b.earned ? style.text : "text-white/20"}`}>{b.tier}</span>
      </div>
      <p className={`text-sm font-semibold ${b.earned ? "text-white/90" : "text-white/45"}`}>{b.name}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-white/35">{b.description}</p>
      {!b.earned && b.progress && (
        <div className="mt-2.5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-white/25" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-right text-[10px] text-white/25 tabular-nums">{pct}%</p>
        </div>
      )}
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default function ProgressPage() {
  const { session } = useAuthSession();
  const user = session?.user ?? null;
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ProgressResult | null>(null);

  const prefs = useMemo(() => loadPrefs(), []);

  useEffect(() => {
    if (!user) return;
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
        .eq("user_id", user.id)
        .gte("date", localDateStr(from))
        .lte("date", todayStr)
        .gte("duration_seconds", prefs.minSessionSeconds);

      if (cancelled) return;
      const rows = (data ?? []) as Array<{ domain: string; duration_seconds: number; date: string }>;
      setResult(
        computeProgress(rows, {
          overrides: prefs.categoryOverrides,
          goalHours: prefs.productiveHoursThreshold,
          todayStr,
        })
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, prefs]);

  if (loading || !result) {
    return <AppShell title="Progress"><Loader /></AppShell>;
  }

  const earnedCount = result.badges.filter((b) => b.earned).length;

  return (
    <AppShell title="Progress">
      <PageHeader
        eyebrow="Gamification"
        title="Your progress"
        subtitle="Accountability score, level, streak, and badges — earned from your own tracked time."
      />

      <div className="space-y-6">
        {/* Hero score */}
        <ScoreHero p={result} />

        {/* Level + streak */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LevelCard p={result} />
          <StreakCard p={result} />
        </div>

        {/* Records + category */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RecordsCard p={result} />
          <CategoryCard p={result} />
        </div>

        {/* Badges */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white/95">Badges</h3>
            <span className="text-xs text-white/40 tabular-nums">{earnedCount} / {result.badges.length} earned</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {result.badges.map((b, i) => <BadgeTile key={b.id} b={b} i={i} />)}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
