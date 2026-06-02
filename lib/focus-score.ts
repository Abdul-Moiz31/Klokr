/**
 * Focus Score — a single 0–100 number summarizing a day's tracked browsing.
 * Deliberately simple and explainable: two components, equally weighted.
 *
 *  1. Goal attainment — tracked time vs the user's productive-hours goal,
 *     capped at 100%. Rewards showing up and putting in the time.
 *  2. Concentration — how much of the day was spent on the top few domains
 *     vs scattered across many. High concentration = deep work; lots of
 *     low-value flitting between many sites drags it down.
 *
 * Both are honest signals derivable from data we already have. No judgment
 * about which domains are "good" — that's the user's call, not ours.
 */

export type DomainSlice = { domain: string; totalSeconds: number };

export type FocusScore = {
  score: number;          // 0–100
  goalPct: number;        // 0–100, tracked vs goal
  concentrationPct: number; // 0–100, share on top 3 domains
  totalSeconds: number;
  label: string;          // human grade
};

function gradeLabel(score: number): string {
  if (score >= 85) return "Locked in";
  if (score >= 70) return "Strong focus";
  if (score >= 50) return "Steady";
  if (score >= 30) return "Scattered";
  return "Just getting started";
}

export function computeFocusScore(
  domains: DomainSlice[],
  goalHours: number
): FocusScore {
  const totalSeconds = domains.reduce((s, d) => s + d.totalSeconds, 0);

  if (totalSeconds === 0) {
    return { score: 0, goalPct: 0, concentrationPct: 0, totalSeconds: 0, label: gradeLabel(0) };
  }

  // 1. Goal attainment, capped at 100%.
  const goalSeconds = Math.max(1, goalHours * 3600);
  const goalPct = Math.min(100, Math.round((totalSeconds / goalSeconds) * 100));

  // 2. Concentration — share of time on the top 3 domains.
  const top3 = [...domains]
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, 3)
    .reduce((s, d) => s + d.totalSeconds, 0);
  const concentrationPct = Math.round((top3 / totalSeconds) * 100);

  const score = Math.round(goalPct * 0.5 + concentrationPct * 0.5);

  return { score, goalPct, concentrationPct, totalSeconds, label: gradeLabel(score) };
}
