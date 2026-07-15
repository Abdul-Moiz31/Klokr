// Server-side timezone math for the notification cron (app/api/cron/notifications).
// The extension has its own equivalent (getOffsetMinutesForZone in
// background.js) for the same reason: neither runs in a browser, so neither
// can rely on Date's local getters reflecting the user's actual timezone —
// both need to derive "the user's local time" from an explicit IANA zone.

/** Minutes offset from UTC for `zone` at `at`, positive west (Date.getTimezoneOffset() convention). */
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
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    return Math.round((at.getTime() - asUTC) / 60_000);
  } catch {
    return 0;
  }
}

/** The user's local hour (0-23) and minutes-since-midnight, for an explicit IANA zone. */
export function localClockForZone(zone: string, at: Date = new Date()): { hour: number; minutes: number; dateKey: string } {
  const offset = getOffsetMinutesForZone(zone, at);
  const shifted = new Date(at.getTime() - offset * 60_000);
  return {
    hour: shifted.getUTCHours(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    dateKey: [
      shifted.getUTCFullYear(),
      String(shifted.getUTCMonth() + 1).padStart(2, "0"),
      String(shifted.getUTCDate()).padStart(2, "0"),
    ].join("-"),
  };
}
