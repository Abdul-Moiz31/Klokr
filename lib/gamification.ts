/**
 * Gamification engine — pure, deterministic functions that turn raw tracked
 * browsing into an accountability score, category-weighted XP, levels, badges,
 * and personal records. No data fetching here; the page feeds in rows.
 *
 * Design principles:
 *  - Honest, explainable math. Every number can be traced to the user's data.
 *  - Category-aware: Deep Work earns the most XP, distractions earn nothing.
 *  - Loss-aversion streaks: the forgiving streak from lib/streak is reused so
 *    the numbers always match the rest of the app.
 */

import type { CategoryId } from "./categories";
import { getCategoryForDomain } from "./categories";
import { localDateStr, calcForgivingStreak } from "./streak";

/* ── XP weights by category ───────────────────────────────────────────────── */
// XP earned per minute spent. Deep Work is the gold standard; pure distractions
// earn nothing (they still show up everywhere else, they just don't level you up).
export const CATEGORY_XP_WEIGHT: Record<CategoryId, number> = {
  focus:         3,
  productivity:  2,
  news:          1,
  comms:         1,
  other:         0.5,
  shopping:      0.25,
  social:        0,
  entertainment: 0,
};

/* ── Levels ───────────────────────────────────────────────────────────────── */
export interface LevelDef { level: number; name: string; minXp: number }

export const LEVELS: LevelDef[] = [
  { level: 1,  name: "Novice",       minXp: 0 },
  { level: 2,  name: "Apprentice",   minXp: 1000 },
  { level: 3,  name: "Focused",      minXp: 3000 },
  { level: 4,  name: "Consistent",   minXp: 6000 },
  { level: 5,  name: "Disciplined",  minXp: 10000 },
  { level: 6,  name: "In Flow",      minXp: 16000 },
  { level: 7,  name: "Deep Worker",  minXp: 24000 },
  { level: 8,  name: "Relentless",   minXp: 35000 },
  { level: 9,  name: "Master",       minXp: 50000 },
  { level: 10, name: "Legend",       minXp: 70000 },
];

export interface LevelInfo {
  level: number;
  name: string;
  totalXp: number;
  /** XP accumulated within the current level. */
  xpIntoLevel: number;
  /** XP span of the current level (Infinity-safe: 0 at max level). */
  levelSpan: number;
  /** 0–100 progress to the next level (100 at max level). */
  progressPct: number;
  /** XP needed to reach the next level, or null at max. */
  xpToNext: number | null;
  nextName: string | null;
  isMax: boolean;
}

export function levelForXp(totalXp: number): LevelInfo {
  let current = LEVELS[0]!;
  for (const l of LEVELS) {
    if (totalXp >= l.minXp) current = l;
    else break;
  }
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null;
  if (!next) {
    return {
      level: current.level, name: current.name, totalXp,
      xpIntoLevel: totalXp - current.minXp, levelSpan: 0,
      progressPct: 100, xpToNext: null, nextName: null, isMax: true,
    };
  }
  const levelSpan   = next.minXp - current.minXp;
  const xpIntoLevel = totalXp - current.minXp;
  const progressPct = Math.min(100, Math.round((xpIntoLevel / levelSpan) * 100));
  return {
    level: current.level, name: current.name, totalXp,
    xpIntoLevel, levelSpan, progressPct,
    xpToNext: next.minXp - totalXp, nextName: next.name, isMax: false,
  };
}

/* ── Domain helpers ───────────────────────────────────────────────────────── */
export type DomainRow = { domain: string; total_seconds: number };

export function categorySeconds(
  domains: DomainRow[],
  overrides: Record<string, CategoryId> = {}
): Record<CategoryId, number> {
  const map: Record<CategoryId, number> = {
    focus: 0, productivity: 0, news: 0, comms: 0, social: 0, entertainment: 0, shopping: 0, other: 0,
  };
  for (const d of domains) {
    const cat = getCategoryForDomain(d.domain, overrides);
    map[cat] += d.total_seconds;
  }
  return map;
}

export function xpForDomains(
  domains: DomainRow[],
  overrides: Record<string, CategoryId> = {}
): number {
  let xp = 0;
  for (const d of domains) {
    const cat = getCategoryForDomain(d.domain, overrides);
    xp += (d.total_seconds / 60) * CATEGORY_XP_WEIGHT[cat];
  }
  return Math.round(xp);
}

/* ── Accountability score ─────────────────────────────────────────────────── */
export interface AccountabilityScore {
  score: number;       // 0–100
  label: string;
  breakdown: {
    goal: number;        // tracked vs goal
    deepWork: number;    // deep-work share of tracked
    lowDistraction: number; // inverse of distraction share
    streak: number;      // 100 if streak alive, else 0
  };
  totalSeconds: number;
  deepSeconds: number;
  distractionSeconds: number;
}

function scoreLabel(score: number): string {
  if (score >= 85) return "Dialed in";
  if (score >= 70) return "On track";
  if (score >= 50) return "Solid";
  if (score >= 30) return "Drifting";
  return "Off the rails";
}

export function computeAccountabilityScore(opts: {
  domains: DomainRow[];
  overrides?: Record<string, CategoryId>;
  goalHours: number;
  streakAlive: boolean;
}): AccountabilityScore {
  const { domains, overrides = {}, goalHours, streakAlive } = opts;
  const cats = categorySeconds(domains, overrides);
  const totalSeconds = domains.reduce((s, d) => s + d.total_seconds, 0);
  const deepSeconds = cats.focus + cats.productivity;
  const distractionSeconds = cats.social + cats.entertainment;

  const goalSeconds = Math.max(1, goalHours * 3600);
  const goal = Math.min(100, (totalSeconds / goalSeconds) * 100);
  const deepWork = totalSeconds > 0 ? (deepSeconds / totalSeconds) * 100 : 0;
  const lowDistraction = totalSeconds > 0 ? 100 - Math.min(100, (distractionSeconds / totalSeconds) * 100) : 100;
  const streak = streakAlive ? 100 : 0;

  const score = Math.round(goal * 0.35 + deepWork * 0.30 + lowDistraction * 0.25 + streak * 0.10);

  return {
    score,
    label: scoreLabel(score),
    breakdown: {
      goal: Math.round(goal),
      deepWork: Math.round(deepWork),
      lowDistraction: Math.round(lowDistraction),
      streak,
    },
    totalSeconds,
    deepSeconds,
    distractionSeconds,
  };
}

/* ── Longest streak (historical record) ───────────────────────────────────── */
export function longestStreak(dailyMap: Map<string, number>): number {
  if (dailyMap.size === 0) return 0;
  const dates = [...dailyMap.keys()].filter((d) => (dailyMap.get(d) ?? 0) > 0).sort();
  if (dates.length === 0) return 0;
  let best = 1, run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]! + "T00:00:00");
    const cur  = new Date(dates[i]! + "T00:00:00");
    const gapDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (gapDays === 1) { run++; best = Math.max(best, run); }
    else run = 1;
  }
  return best;
}

/* ── Badges ───────────────────────────────────────────────────────────────── */
export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

export interface Badge {
  id: string;
  name: string;
  description: string;
  tier: BadgeTier;
  earned: boolean;
  /** When unearned, how close the user is. */
  progress?: { current: number; target: number };
}

export interface BadgeStats {
  totalTrackedSeconds: number;
  totalDeepSeconds: number;
  bestDeepDaySeconds: number;
  longestStreakDays: number;
  distractionFreeDays: number;  // days with >1h tracked and <30m distraction
  level: number;
  bestScore: number;
}

export function computeBadges(s: BadgeStats): Badge[] {
  const HOUR = 3600;
  const defs: Badge[] = [
    {
      id: "first-hour", name: "First Hour", tier: "bronze",
      description: "Track your first hour of focused time",
      earned: s.totalTrackedSeconds >= HOUR,
      progress: { current: Math.min(s.totalTrackedSeconds, HOUR), target: HOUR },
    },
    {
      id: "deep-diver", name: "Deep Diver", tier: "silver",
      description: "Log 4+ hours of Deep Work in a single day",
      earned: s.bestDeepDaySeconds >= 4 * HOUR,
      progress: { current: Math.min(s.bestDeepDaySeconds, 4 * HOUR), target: 4 * HOUR },
    },
    {
      id: "week-warrior", name: "Week Warrior", tier: "silver",
      description: "Reach a 7-day tracking streak",
      earned: s.longestStreakDays >= 7,
      progress: { current: Math.min(s.longestStreakDays, 7), target: 7 },
    },
    {
      id: "distraction-fighter", name: "Distraction Fighter", tier: "gold",
      description: "5 days with under 30m of social + entertainment",
      earned: s.distractionFreeDays >= 5,
      progress: { current: Math.min(s.distractionFreeDays, 5), target: 5 },
    },
    {
      id: "focused-fifty", name: "Focused Fifty", tier: "gold",
      description: "Accumulate 50 hours of Deep Work",
      earned: s.totalDeepSeconds >= 50 * HOUR,
      progress: { current: Math.min(s.totalDeepSeconds, 50 * HOUR), target: 50 * HOUR },
    },
    {
      id: "centurion", name: "Centurion", tier: "platinum",
      description: "Accumulate 100 hours of Deep Work",
      earned: s.totalDeepSeconds >= 100 * HOUR,
      progress: { current: Math.min(s.totalDeepSeconds, 100 * HOUR), target: 100 * HOUR },
    },
    {
      id: "streak-thirty", name: "Unbreakable", tier: "platinum",
      description: "Reach a 30-day tracking streak",
      earned: s.longestStreakDays >= 30,
      progress: { current: Math.min(s.longestStreakDays, 30), target: 30 },
    },
    {
      id: "perfect-day", name: "Perfect Day", tier: "gold",
      description: "Hit a 90+ accountability score on any day",
      earned: s.bestScore >= 90,
      progress: { current: Math.min(s.bestScore, 90), target: 90 },
    },
    {
      id: "level-five", name: "Disciplined", tier: "gold",
      description: "Reach Level 5",
      earned: s.level >= 5,
      progress: { current: Math.min(s.level, 5), target: 5 },
    },
  ];
  return defs;
}

/**
 * Forces `earned: true` (and fills in progress as complete) for any badge
 * whose id is in `persistedBadgeIds`, regardless of what the live rolling-
 * window computation says. computeBadges() only sees the last 90 days of
 * tab_sessions, so a badge that was genuinely earned can otherwise flip back
 * to unearned once the qualifying activity ages out of that window — this is
 * the fix: once persisted (see user_achievements, migration 014), a badge can
 * never appear unearned again.
 */
export function mergeEarnedAchievements(badges: Badge[], persistedBadgeIds: ReadonlySet<string>): Badge[] {
  if (persistedBadgeIds.size === 0) return badges;
  return badges.map((b) => {
    if (!persistedBadgeIds.has(b.id) || b.earned) return b;
    return { ...b, earned: true, progress: b.progress ? { ...b.progress, current: b.progress.target } : undefined };
  });
}

/* ── Top-level: compute everything for the Progress page ──────────────────── */
export interface PerDay {
  date: string;
  totalSeconds: number;
  deepSeconds: number;
  distractionSeconds: number;
  xp: number;
  score: number;
}

export interface ProgressResult {
  totalXp: number;
  level: LevelInfo;
  today: AccountabilityScore;
  currentStreak: number;
  streakAtRisk: boolean;
  graceUsed: boolean;
  records: {
    bestDeepDaySeconds: number;
    bestDeepDayDate: string | null;
    bestScore: number;
    bestScoreDate: string | null;
    bestTotalDaySeconds: number;
    bestTotalDayDate: string | null;
    longestStreakDays: number;
  };
  badges: Badge[];
  categoryTotals: Record<CategoryId, number>;
  perDay: PerDay[];
}

export function computeProgress(
  rows: Array<{ domain: string; duration_seconds: number; date: string }>,
  opts: { overrides?: Record<string, CategoryId>; goalHours: number; todayStr: string }
): ProgressResult {
  const { overrides = {}, goalHours, todayStr } = opts;

  // Group rows by date, keeping per-domain seconds.
  const byDate = new Map<string, Map<string, number>>();
  const dailyTotal = new Map<string, number>();
  for (const r of rows) {
    const dm = byDate.get(r.date) ?? new Map<string, number>();
    dm.set(r.domain, (dm.get(r.domain) ?? 0) + r.duration_seconds);
    byDate.set(r.date, dm);
    dailyTotal.set(r.date, (dailyTotal.get(r.date) ?? 0) + r.duration_seconds);
  }

  const categoryTotals: Record<CategoryId, number> = {
    focus: 0, productivity: 0, news: 0, comms: 0, social: 0, entertainment: 0, shopping: 0, other: 0,
  };

  let totalXp = 0;
  let totalDeepSeconds = 0;
  let totalTrackedSeconds = 0;
  let distractionFreeDays = 0;

  const perDay: PerDay[] = [];
  let bestDeepDaySeconds = 0, bestDeepDayDate: string | null = null;
  let bestScore = 0, bestScoreDate: string | null = null;
  let bestTotalDaySeconds = 0, bestTotalDayDate: string | null = null;

  for (const [date, dm] of byDate) {
    const domains: DomainRow[] = [...dm.entries()].map(([domain, total_seconds]) => ({ domain, total_seconds }));
    const cats = categorySeconds(domains, overrides);
    const dayTotal = domains.reduce((s, d) => s + d.total_seconds, 0);
    const deep = cats.focus + cats.productivity;
    const distract = cats.social + cats.entertainment;
    const xp = xpForDomains(domains, overrides);

    // Per-day score (streakAlive proxied by "had activity that day").
    const dayScore = computeAccountabilityScore({ domains, overrides, goalHours, streakAlive: dayTotal > 0 }).score;

    for (const id of Object.keys(cats) as CategoryId[]) categoryTotals[id] += cats[id];
    totalXp += xp;
    totalDeepSeconds += deep;
    totalTrackedSeconds += dayTotal;
    if (dayTotal > 3600 && distract < 30 * 60) distractionFreeDays++;

    if (deep > bestDeepDaySeconds) { bestDeepDaySeconds = deep; bestDeepDayDate = date; }
    if (dayScore > bestScore) { bestScore = dayScore; bestScoreDate = date; }
    if (dayTotal > bestTotalDaySeconds) { bestTotalDaySeconds = dayTotal; bestTotalDayDate = date; }

    perDay.push({ date, totalSeconds: dayTotal, deepSeconds: deep, distractionSeconds: distract, xp, score: dayScore });
  }

  perDay.sort((a, b) => (a.date < b.date ? -1 : 1));

  const fs = calcForgivingStreak(dailyTotal, todayStr);
  const longest = longestStreak(dailyTotal);

  // Today's score.
  const todayDm = byDate.get(todayStr) ?? new Map<string, number>();
  const todayDomains: DomainRow[] = [...todayDm.entries()].map(([domain, total_seconds]) => ({ domain, total_seconds }));
  const today = computeAccountabilityScore({
    domains: todayDomains, overrides, goalHours, streakAlive: fs.count > 0,
  });

  const level = levelForXp(totalXp);

  const badges = computeBadges({
    totalTrackedSeconds,
    totalDeepSeconds,
    bestDeepDaySeconds,
    longestStreakDays: longest,
    distractionFreeDays,
    level: level.level,
    bestScore,
  });

  return {
    totalXp,
    level,
    today,
    currentStreak: fs.count,
    streakAtRisk: fs.atRisk,
    graceUsed: fs.graceUsed,
    records: {
      bestDeepDaySeconds, bestDeepDayDate,
      bestScore, bestScoreDate,
      bestTotalDaySeconds, bestTotalDayDate,
      longestStreakDays: longest,
    },
    badges,
    categoryTotals,
    perDay,
  };
}

/* ── Small format helper shared by gamification UI ────────────────────────── */
export function fmtHm(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export { localDateStr };
