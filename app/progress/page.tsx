"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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

/* ── helpers ──────────────────────────────────────────────── */

function scoreColor(s: number) {
  if (s >= 70) return "#10B981";
  if (s >= 40) return "#7C3AED";
  return "#F59E0B";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInsight(p: ProgressResult, goalHours: number): string {
  const { today, streakAtRisk, currentStreak } = p;
  if (streakAtRisk && currentStreak > 0)
    return `Your ${currentStreak}-day streak is at risk — track something today to keep it.`;
  if (today.totalSeconds === 0)
    return "No tracking yet today. Start browsing to build your score.";
  const needed = goalHours * 3600 - today.totalSeconds;
  if (needed > 300 && today.totalSeconds < goalHours * 3600 * 0.85)
    return `${fmtHm(needed)} left to hit your daily ${goalHours}h goal.`;
  if (today.breakdown.deepWork < 30)
    return "Try some focused, distraction-free work to boost your Deep Work score.";
  if (today.score >= 80) return "Excellent day — you're in the top range. Keep that focus going.";
  if (today.score >= 60) return "Solid progress. Push your deep work ratio to break into the top tier.";
  return "Keep going — every minute of focused work adds to your score.";
}

/* ── Score Hero ───────────────────────────────────────────── */

function ScoreHero({ p, goalHours, todayStr }: { p: ProgressResult; goalHours: number; todayStr: string }) {
  const { today, level } = p;
  const color = scoreColor(today.score);
  const R = 52, C = 2 * Math.PI * R;
  const dash = (today.score / 100) * C;
  const insight = getInsight(p, goalHours);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStr + "T00:00:00");
    d.setDate(d.getDate() - (6 - i));
    const dateStr = localDateStr(d);
    const day = p.perDay.find(pd => pd.date === dateStr);
    return {
      dateStr,
      tracked: !!(day && day.totalSeconds > 0),
      isToday: i === 6,
      label: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1),
    };
  });

  const chips = [
    { label: "Goal", value: `${today.breakdown.goal}%`, hint: "time vs target" },
    { label: "Deep Work", value: `${today.breakdown.deepWork}%`, hint: "focused time" },
    { label: "No Distraction", value: `${today.breakdown.lowDistraction}%`, hint: "focus quality" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.07] via-white/[0.02] to-cyan-500/[0.04] p-4 sm:p-5"
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
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
            <span className="text-[10px] uppercase tracking-widest text-white/35">score</span>
          </div>
        </div>

        {/* Right panel */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-white/95">Today&apos;s accountability</h2>
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ color, borderColor: `${color}55`, background: `${color}18` }}>
              {today.label}
            </span>
          </div>
          <p className="mb-4 text-xs text-white/45">{insight}</p>

          {/* 3 stat chips */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            {chips.map(c => (
              <div key={c.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-center">
                <p className="text-xl font-black tabular-nums text-white">{c.value}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-white/50">{c.label}</p>
                <p className="text-[9px] text-white/25">{c.hint}</p>
              </div>
            ))}
          </div>

          {/* Level bar */}
          <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-violet-500/30 bg-violet-600/20 text-[11px] font-bold text-violet-200">
                  {level.level}
                </span>
                <span className="text-sm font-semibold text-white/80">{level.name}</span>
              </div>
              <span className="shrink-0 text-[11px] text-white/35 tabular-nums">
                {level.isMax ? "Max level" : `${level.xpToNext?.toLocaleString()} XP to ${level.nextName}`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${level.progressPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
              />
            </div>
          </div>

          {/* 7-day dots */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${p.currentStreak >= 7 ? "bg-orange-500/15 text-orange-300" : "bg-violet-500/15 text-violet-300"}`}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </span>
              <span className="text-xs text-white/50">
                <span className="font-semibold text-white/80">{p.currentStreak} day{p.currentStreak !== 1 ? "s" : ""}</span>
                {p.streakAtRisk
                  ? <span className="ml-1.5 text-amber-300/90">· at risk today</span>
                  : <span className="text-white/40"> streak</span>}
              </span>
            </div>
            <div className="flex items-end gap-1.5">
              {last7.map(day => (
                <div key={day.dateStr} className="flex flex-col items-center gap-1">
                  <div className={`h-4 w-4 rounded-full ${
                    day.tracked
                      ? "bg-gradient-to-br from-violet-500 to-cyan-400"
                      : day.isToday
                        ? "border border-white/25"
                        : "border border-white/[0.08] bg-white/[0.05]"
                  } ${day.isToday ? "ring-2 ring-violet-500/35 ring-offset-1 ring-offset-transparent" : ""}`} />
                  <span className="text-[8px] text-white/20">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Score Trend chart ────────────────────────────────────── */

const TrendTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  const score = payload[0]?.value ?? 0;
  const color = scoreColor(score);
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f0f16]/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
      <p className="text-[11px] text-white/40">{label}</p>
      <p className="text-base font-bold tabular-nums" style={{ color }}>
        {score}<span className="ml-0.5 text-xs font-normal text-white/30">/100</span>
      </p>
    </div>
  );
};

function ScoreTrend({ p, todayStr, chartMounted }: { p: ProgressResult; todayStr: string; chartMounted: boolean }) {
  const data = p.perDay
    .filter(d => d.date <= todayStr)
    .slice(-30)
    .map(d => ({
      label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: d.score,
    }));

  if (data.length < 3) return null;

  const avg = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);
  const best = Math.max(...data.map(d => d.score));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 }}
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]"
    >
      <div className="border-b border-white/[0.07] px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white/90">Score trend</h3>
            <p className="mt-0.5 text-xs text-white/40">Accountability score — last {data.length} tracked days</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums text-white">{avg}</p>
              <p className="text-[10px] text-white/35">avg</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums text-emerald-300">{best}</p>
              <p className="text-[10px] text-white/35">best</p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-2 pb-4 pt-3 sm:px-3">
        <div className="h-44">
          {chartMounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="score-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "rgba(124,58,237,0.2)", strokeDasharray: "3 3" }} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  fill="url(#score-grad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#7C3AED", strokeWidth: 0 }}
                  isAnimationActive
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Level Card ───────────────────────────────────────────── */

function LevelCard({ p }: { p: ProgressResult }) {
  const { level } = p;
  const xpSources = (Object.keys(p.categoryTotals) as CategoryId[])
    .filter(id => p.categoryTotals[id] > 0)
    .map(id => ({ id, seconds: p.categoryTotals[id] }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
    >
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-white/30">Level &amp; XP</p>

      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-600/30 to-cyan-600/20 text-2xl font-black text-white shadow-lg shadow-violet-900/30">
          {level.level}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-white/95">{level.name}</p>
          <p className="text-xs text-white/40">{level.totalXp.toLocaleString()} XP total</p>
        </div>
        {!level.isMax ? (
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-violet-300 tabular-nums">{level.xpToNext?.toLocaleString()}</p>
            <p className="text-[10px] text-white/35">XP to {level.nextName}</p>
          </div>
        ) : (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">Max</span>
        )}
      </div>

      <div className="mb-1 flex justify-between text-[10px] text-white/30">
        <span>Lv {level.level}</span>
        {!level.isMax && <span>Lv {level.level + 1}</span>}
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${level.progressPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
        />
      </div>
      <p className="mt-1.5 text-[10px] text-white/25 tabular-nums">
        {level.xpIntoLevel.toLocaleString()} / {level.isMax ? "MAX" : level.levelSpan.toLocaleString()} XP this level
      </p>

      {xpSources.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="mb-2.5 text-[10px] text-white/25">Top XP sources (90 days)</p>
          <div className="space-y-2">
            {xpSources.map(e => (
              <div key={e.id} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORIES[e.id].color }} />
                <span className="flex-1 truncate text-xs text-white/55">{CATEGORIES[e.id].label}</span>
                <span className="text-xs text-white/40 tabular-nums">{fmtHm(e.seconds)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-white/20">Deep Work earns 3× XP · Social &amp; Entertainment earn 0×</p>
        </div>
      )}
    </motion.div>
  );
}

/* ── Streak Card ──────────────────────────────────────────── */

function StreakCard({ p, todayStr }: { p: ProgressResult; todayStr: string }) {
  const hot = p.currentStreak >= 7;

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(todayStr + "T00:00:00");
    d.setDate(d.getDate() - (13 - i));
    const dateStr = localDateStr(d);
    const day = p.perDay.find(pd => pd.date === dateStr);
    return {
      dateStr,
      tracked: !!(day && day.totalSeconds > 0),
      isToday: i === 13,
      score: day?.score ?? 0,
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.16 }}
      className={`rounded-xl border p-4 ${p.streakAtRisk ? "border-amber-500/25 bg-amber-500/[0.05]" : "border-white/[0.08] bg-white/[0.03]"}`}
    >
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-white/30">Streak</p>

      <div className="mb-5 flex items-center gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${hot ? "bg-orange-500/15 text-orange-300" : "bg-violet-500/15 text-violet-300"}`}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </span>
        <div>
          <p className="text-3xl font-black leading-none text-white tabular-nums">
            {p.currentStreak}<span className="ml-1 text-sm font-medium text-white/40">days</span>
          </p>
          <p className={`mt-1 text-xs ${p.streakAtRisk ? "text-amber-300/90" : "text-white/45"}`}>
            {p.currentStreak === 0
              ? "Start your streak today"
              : p.streakAtRisk
                ? "At risk — browse today to keep it"
                : p.graceUsed
                  ? "Active · 1 missed day forgiven"
                  : "Active streak"}
          </p>
        </div>
      </div>

      {/* 14-day activity bars */}
      <div className="mb-4">
        <p className="mb-2 text-[10px] text-white/25">Last 14 days</p>
        <div className="flex gap-1">
          {last14.map(day => (
            <div
              key={day.dateStr}
              title={`${day.dateStr}: ${day.tracked ? `score ${day.score}` : "no data"}`}
              className={`h-6 flex-1 rounded-sm transition-all ${
                day.tracked
                  ? day.score >= 70
                    ? "bg-emerald-500/65"
                    : day.score >= 40
                      ? "bg-violet-500/65"
                      : "bg-violet-800/60"
                  : day.isToday
                    ? "border border-white/15 bg-transparent"
                    : "bg-white/[0.05]"
              } ${day.isToday ? "ring-1 ring-violet-500/30" : ""}`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] text-white/20">
          <span>14d ago</span>
          <span>Today</span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[9px] text-white/25">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/65" /> 70+</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-violet-500/65" /> 40–69</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-violet-800/60" /> &lt;40</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
        <div>
          <p className="text-[10px] text-white/35">Longest ever</p>
          <p className="text-sm font-bold text-white tabular-nums">{p.records.longestStreakDays} days</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/35">Grace day</p>
          <p className={`text-sm font-bold ${p.graceUsed ? "text-amber-300" : "text-emerald-300"}`}>
            {p.graceUsed ? "Used" : "Available"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Records Card ─────────────────────────────────────────── */

function RecordsCard({ p }: { p: ProgressResult }) {
  const recs = [
    { label: "Best deep-work day",  value: fmtHm(p.records.bestDeepDaySeconds),  sub: fmtDate(p.records.bestDeepDayDate) },
    { label: "Best score",          value: String(p.records.bestScore),           sub: fmtDate(p.records.bestScoreDate) },
    { label: "Most tracked day",    value: fmtHm(p.records.bestTotalDaySeconds), sub: fmtDate(p.records.bestTotalDayDate) },
    { label: "Longest streak",      value: `${p.records.longestStreakDays}d`,     sub: "all time" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
    >
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-white/30">Personal records</p>
      <div className="grid grid-cols-2 gap-3">
        {recs.map(r => (
          <div key={r.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-xl font-black tabular-nums text-white">{r.value}</p>
            <p className="mt-0.5 text-xs font-medium text-white/55">{r.label}</p>
            <p className="mt-0.5 text-[10px] text-white/25">{r.sub}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Category Card ────────────────────────────────────────── */

function CategoryCard({ p }: { p: ProgressResult }) {
  const entries = (Object.keys(p.categoryTotals) as CategoryId[])
    .map(id => ({ id, seconds: p.categoryTotals[id] }))
    .filter(e => e.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
  const total = entries.reduce((s, e) => s + e.seconds, 0) || 1;
  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.24 }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
    >
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-white/30">Time by category (90d)</p>

      <div className="mb-4 flex h-4 w-full overflow-hidden rounded-full">
        {entries.map(e => (
          <motion.div
            key={e.id}
            initial={{ width: 0 }}
            animate={{ width: `${(e.seconds / total) * 100}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            style={{ background: CATEGORIES[e.id].color }}
            title={CATEGORIES[e.id].label}
          />
        ))}
      </div>

      <div className="space-y-2.5">
        {entries.map(e => {
          const pct = Math.round((e.seconds / total) * 100);
          return (
            <div key={e.id} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CATEGORIES[e.id].color }} />
              <span className="flex-1 truncate text-sm text-white/65">{CATEGORIES[e.id].label}</span>
              <span className="w-9 text-right text-xs text-white/35 tabular-nums">{pct}%</span>
              <span className="shrink-0 whitespace-nowrap text-right text-sm font-medium text-white/75 tabular-nums">{fmtHm(e.seconds)}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ── Badges ───────────────────────────────────────────────── */

const BADGE_ICONS: Record<string, ReactNode> = {
  "first-hour": <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  "deep-diver": <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>,
  "week-warrior": <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
  "distraction-fighter": <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  "focused-fifty": <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /></svg>,
  "centurion": <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  "streak-thirty": <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
  "perfect-day": <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" /><circle cx="12" cy="8" r="6" /></svg>,
  "level-five": <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
};

const TIER_STYLE: Record<string, { ring: string; bg: string; text: string }> = {
  bronze:   { ring: "border-amber-700/40",  bg: "bg-amber-700/10",  text: "text-amber-500" },
  silver:   { ring: "border-slate-400/40",  bg: "bg-slate-400/10",  text: "text-slate-300" },
  gold:     { ring: "border-yellow-500/40", bg: "bg-yellow-500/10", text: "text-yellow-400" },
  platinum: { ring: "border-cyan-400/40",   bg: "bg-cyan-400/10",   text: "text-cyan-300" },
};

function badgeProgressLabel(b: Badge): string {
  if (!b.progress) return "";
  const { current, target } = b.progress;
  if (b.id === "first-hour") return `${Math.round(current / 60)} / 60 min`;
  if (b.id === "deep-diver") return `${(current / 3600).toFixed(1)} / 4h deep work`;
  if (b.id === "week-warrior") return `${current} / ${target} days`;
  if (b.id === "streak-thirty") return `${current} / ${target} days`;
  if (b.id === "distraction-fighter") return `${current} / ${target} clean days`;
  if (b.id === "focused-fifty") return `${Math.round(current / 3600)} / 50h deep work`;
  if (b.id === "centurion") return `${Math.round(current / 3600)} / 100h deep work`;
  if (b.id === "perfect-day") return `Best score: ${current} / ${target}`;
  if (b.id === "level-five") return `Level ${current} / ${target}`;
  return `${Math.round((current / target) * 100)}%`;
}

function BadgeTile({ b, i }: { b: Badge; i: number }) {
  const style = TIER_STYLE[b.tier] ?? TIER_STYLE.bronze!;
  const pct = b.progress ? Math.min(100, Math.round((b.progress.current / b.progress.target) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.28 + i * 0.04 }}
      className={`relative rounded-xl border p-4 ${b.earned ? `${style.ring} ${style.bg}` : "border-white/[0.06] bg-white/[0.02]"}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          b.earned
            ? `${style.ring} ${style.bg} ${style.text}`
            : "border-white/[0.08] bg-white/[0.03] text-white/20"
        }`}>
          {b.earned
            ? (BADGE_ICONS[b.id] ?? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" /></svg>)
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          }
        </span>
        <span className={`text-[9px] font-bold uppercase tracking-wide ${b.earned ? style.text : "text-white/15"}`}>
          {b.tier}
        </span>
      </div>

      <p className={`text-sm font-bold leading-tight ${b.earned ? "text-white/95" : "text-white/40"}`}>{b.name}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-white/30">{b.description}</p>

      {b.earned ? (
        <div className="mt-2 flex items-center gap-1">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={style.text}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className={`text-[10px] font-semibold ${style.text}`}>Earned</span>
        </div>
      ) : b.progress ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-violet-500/70 to-cyan-400/70"
            />
          </div>
          <p className="mt-1 text-[10px] text-white/25 tabular-nums">{badgeProgressLabel(b)}</p>
        </div>
      ) : null}
    </motion.div>
  );
}

function BadgesSection({ badges }: { badges: Badge[] }) {
  const earned = badges.filter(b => b.earned);
  const inProgress = badges
    .filter(b => !b.earned && b.progress && b.progress.current > 0)
    .sort((a, b) => {
      const pA = a.progress ? a.progress.current / a.progress.target : 0;
      const pB = b.progress ? b.progress.current / b.progress.target : 0;
      return pB - pA;
    });
  const locked = badges.filter(b => !b.earned && (!b.progress || b.progress.current === 0));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white/90">Achievements</h3>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/40 tabular-nums">
          {earned.length} / {badges.length} earned
        </span>
      </div>

      {earned.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-400/70">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Earned · {earned.length}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {earned.map((b, i) => <BadgeTile key={b.id} b={b} i={i} />)}
          </div>
        </div>
      )}

      {inProgress.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-violet-400/60">In Progress · {inProgress.length}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {inProgress.map((b, i) => <BadgeTile key={b.id} b={b} i={i} />)}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/20">Locked · {locked.length}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {locked.map((b, i) => <BadgeTile key={b.id} b={b} i={i} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default function ProgressPage() {
  const { session } = useAuthSession();
  const user = session?.user ?? null;
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ProgressResult | null>(null);
  const [chartMounted, setChartMounted] = useState(false);

  const prefs = useMemo(() => loadPrefs(), []);
  const todayStr = useMemo(() => localDateStr(new Date()), []);

  useEffect(() => { setChartMounted(true); }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const today = new Date();
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
      setResult(computeProgress(rows, {
        overrides: prefs.categoryOverrides,
        goalHours: prefs.productiveHoursThreshold,
        todayStr,
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, prefs, todayStr]);

  if (loading || !result) {
    return <AppShell title="Progress"><Loader /></AppShell>;
  }

  return (
    <AppShell title="Progress">
      <PageHeader
        eyebrow="Your progress"
        title="Progress"
        subtitle="Accountability score, level, streak, and achievements — earned from your own tracked time."
      />

      <div className="space-y-4">
        <ScoreHero p={result} goalHours={prefs.productiveHoursThreshold} todayStr={todayStr} />
        <ScoreTrend p={result} todayStr={todayStr} chartMounted={chartMounted} />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <LevelCard p={result} />
          <StreakCard p={result} todayStr={todayStr} />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <RecordsCard p={result} />
          <CategoryCard p={result} />
        </div>

        <BadgesSection badges={result.badges} />
      </div>
    </AppShell>
  );
}
