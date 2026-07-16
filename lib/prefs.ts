import type { CategoryId } from "./categories";

export interface KlokrsNotificationPrefs {
  dayStart: boolean;
  dayComplete: boolean;
  /** "Reading has started" the moment a scheduled task's window begins. */
  taskStarted: boolean;
  /** "Reading ends in 5 minutes" heads-up before a scheduled task's window closes. */
  taskEndingSoon: boolean;
}

export interface KlokrsPrefs {
  minSessionSeconds: number;
  idleTimeoutMinutes: number;
  workStartHour: number;
  workEndHour: number;
  dailySummaryEnabled: boolean;
  productiveHoursThreshold: number;
  notifications: KlokrsNotificationPrefs;
  /** IANA time zone, e.g. "America/New_York". null = auto-detect from browser. */
  timezone: string | null;
  /** When true, scheduled tasks auto-complete at window end if on-task % >= threshold. */
  autoCompleteEnabled: boolean;
  /** % of the scheduled window that must be on tagged domains for auto-completion. Range 50–100. */
  autoCompleteThreshold: number;
  /** Minimum unscheduled gap (minutes) that surfaces as a red Background-activity block. */
  redBlockMinGapMinutes: number;
  /** User overrides for domain→category mapping. Keyed by root domain. */
  categoryOverrides: Record<string, CategoryId>;
  /**
   * Domains blocked at all times, independent of any schedule — no on/off
   * toggle, presence in this list is the enforcement. Distinct from a
   * planner task's own blockedDomainTags, which only apply during that
   * task's scheduled window.
   */
  alwaysBlockedDomains: string[];
}

export const DEFAULT_PREFS: KlokrsPrefs = {
  minSessionSeconds: 10,
  idleTimeoutMinutes: 2,
  workStartHour: 9,
  workEndHour: 17,
  dailySummaryEnabled: false,
  productiveHoursThreshold: 4,
  notifications: {
    dayStart: true,
    dayComplete: true,
    taskStarted: true,
    taskEndingSoon: true,
  },
  timezone: null,
  autoCompleteEnabled: true,
  autoCompleteThreshold: 80,
  redBlockMinGapMinutes: 15,
  categoryOverrides: {},
  alwaysBlockedDomains: [],
};

/** Resolves the user's effective time zone: stored override or browser default. */
export function resolveTimezone(prefs: Pick<KlokrsPrefs, "timezone">): string {
  if (prefs.timezone) return prefs.timezone;
  if (typeof Intl !== "undefined") {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* ignore */ }
  }
  return "UTC";
}

/** Minutes offset from UTC for a given IANA zone right now. Negative east of UTC, positive west, matching Date.getTimezoneOffset(). */
export function getOffsetMinutesForZone(zone: string, at: Date = new Date()): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
    const asUTC = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    return Math.round((at.getTime() - asUTC) / 60000);
  } catch {
    return at.getTimezoneOffset();
  }
}

export const PREFS_KEY = "Klokrs_prefs";

export function loadPrefs(): KlokrsPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KlokrsPrefs>;
      return {
        ...DEFAULT_PREFS,
        ...parsed,
        notifications: { ...DEFAULT_PREFS.notifications, ...(parsed.notifications ?? {}) },
        categoryOverrides: { ...(parsed.categoryOverrides ?? {}) },
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_PREFS;
}

export function savePrefs(p: KlokrsPrefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }
  catch { /* ignore */ }
}

// ─── Timezone-aware "today"/local-clock helpers ───────────────────────────────
//
// Every one of these takes `prefs` and resolves the effective zone via
// resolveTimezone() (stored override, else the browser's own zone) — never a
// raw `new Date()` getter. Before this existed, only the dashboard's top-line
// stats actually respected `prefs.timezone`; every other feature (streaks,
// weekly review, reports, activity, progress, notifications) computed "today"
// from the browser-local clock instead. For a user whose stored timezone
// differs from their device's, the same physical moment could land on two
// different calendar days depending on which widget was looking at it —
// breaking streaks in one place and not another, and comparing "today" against
// the wrong Daily Planner day right at a midnight boundary. Route every
// day-boundary computation through these instead of reaching for `new Date()`
// getters directly.

/** "YYYY-MM-DD" for `date` in the effective timezone from `prefs`. */
export function getLocalDateString(
  prefs: Pick<KlokrsPrefs, "timezone">,
  date: Date = new Date()
): string {
  const zone = resolveTimezone(prefs);
  try {
    // en-CA renders ISO-shaped "YYYY-MM-DD" reliably across browsers.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date);
  } catch {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }
}

/** The user's local hour (0-23) in the effective timezone from `prefs`. */
export function getLocalHour(
  prefs: Pick<KlokrsPrefs, "timezone">,
  date: Date = new Date()
): number {
  const zone = resolveTimezone(prefs);
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "2-digit", hourCycle: "h23",
    }).format(date);
    const parsed = parseInt(h, 10);
    if (!Number.isNaN(parsed)) return parsed;
  } catch { /* fall through */ }
  return date.getHours();
}

/** Minutes since local midnight (0-1439) in the effective timezone from `prefs`. */
export function getLocalMinutes(
  prefs: Pick<KlokrsPrefs, "timezone">,
  date: Date = new Date()
): number {
  const zone = resolveTimezone(prefs);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "", 10);
    if (!Number.isNaN(h) && !Number.isNaN(m)) return h * 60 + m;
  } catch { /* fall through */ }
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Local midnight of `date`'s calendar day, in the effective timezone from
 * `prefs`, expressed as a real Date (UTC instant of that local midnight).
 * Useful for date-range math (e.g. "N days ago") that needs to stay anchored
 * to the user's calendar day rather than the browser's.
 */
export function getLocalDayStart(
  prefs: Pick<KlokrsPrefs, "timezone">,
  date: Date = new Date()
): Date {
  const dateStr = getLocalDateString(prefs, date);
  const offsetMin = getOffsetMinutesForZone(resolveTimezone(prefs), date);
  // dateStr is "YYYY-MM-DD" in the local zone; interpreting it as UTC and then
  // adding back the zone's offset gives the UTC instant of that zone's midnight.
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + offsetMin * 60_000);
}

/**
 * Adds `days` (negative to go backward) to a "YYYY-MM-DD" string, returning a
 * new "YYYY-MM-DD" string. Anchored at UTC noon internally so the arithmetic
 * can never get shifted by a DST transition — this is pure calendar-date
 * math, not a wall-clock computation, so it deliberately doesn't take `prefs`.
 * Pairs with getLocalDateString() for range queries: derive "today" with
 * getLocalDateString(prefs), then derive "N days ago" from that same string
 * with this, rather than computing each end of the range independently.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * "YYYY-MM-DD" of the Monday that starts the calendar week containing
 * `date`, in the effective timezone from `prefs`. Centralizes the
 * Monday-start-of-week convention — previously reimplemented independently
 * in a couple of places with different Date-construction patterns, a
 * correctness landmine waiting for one copy to drift from the other.
 */
export function getMondayDateString(
  prefs: Pick<KlokrsPrefs, "timezone">,
  date: Date = new Date()
): string {
  const dateStr = getLocalDateString(prefs, date);
  // Parsing as UTC noon and reading UTCDay avoids any local-timezone
  // reinterpretation of what's already a pure calendar-date string.
  const weekday = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDaysToDateString(dateStr, diff);
}

export type DayPhase = "pending" | "active" | "complete";

/**
 * Mirrors the extension's getDayPhase() in background.js — kept in sync
 * manually since the two run in different JS contexts. Distinguishes
 * "hasn't started yet today" from "already finished today" so dashboard
 * empty states don't claim tracking is live when it isn't.
 */
export function getDayPhase(
  prefs: Pick<KlokrsPrefs, "workStartHour" | "workEndHour" | "timezone">,
  date: Date = new Date()
): DayPhase {
  const { workStartHour, workEndHour } = prefs;
  if (workStartHour === workEndHour) return "active"; // 24h tracking — no window
  const hour = getLocalHour(prefs, date);
  if (workStartHour < workEndHour) {
    if (hour < workStartHour) return "pending";
    if (hour >= workEndHour) return "complete";
    return "active";
  }
  return hour >= workStartHour || hour < workEndHour ? "active" : "complete";
}
