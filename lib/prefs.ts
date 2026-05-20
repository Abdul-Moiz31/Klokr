export interface KlokrsNotificationPrefs {
  dayStart: boolean;
  dayComplete: boolean;
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
  },
  timezone: null,
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
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_PREFS;
}

export function savePrefs(p: KlokrsPrefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }
  catch { /* ignore */ }
}
