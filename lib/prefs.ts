export interface TablyPrefs {
  minSessionSeconds: number;
  idleTimeoutMinutes: number;
  workStartHour: number;
  workEndHour: number;
  dailySummaryEnabled: boolean;
  productiveHoursThreshold: number;
}

export const DEFAULT_PREFS: TablyPrefs = {
  minSessionSeconds: 10,
  idleTimeoutMinutes: 2,
  workStartHour: 9,
  workEndHour: 18,
  dailySummaryEnabled: false,
  productiveHoursThreshold: 4,
};

export const PREFS_KEY = "tably_prefs";

export function loadPrefs(): TablyPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<TablyPrefs>) };
  } catch { /* ignore */ }
  return DEFAULT_PREFS;
}

export function savePrefs(p: TablyPrefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }
  catch { /* ignore */ }
}
