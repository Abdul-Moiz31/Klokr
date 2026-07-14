import type { RoutineTemplateKind } from "./types";

// Local calendar date (YYYY-MM-DD), read off the CURRENT RUNTIME's timezone.
// Correct wherever this runs in the browser (the runtime's timezone IS the
// user's) — every client-side call site relies on that. Do NOT call this
// server-side with a bare `new Date()`: the server's runtime timezone is not
// the user's (e.g. UTC on Vercel regardless of who's asking) — use
// dayKeyForOffset() there instead, with the client's tz offset.
//
// (This used to read the UTC calendar date via toISOString(), which silently
// resolved "today" to the wrong day for hours every evening for any user west
// of UTC — matches localDateStr() in lib/streak.ts, which had it right.)
export function dayKey(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// Same calendar-date calculation as dayKey(), for server contexts where the
// runtime's own timezone isn't the user's. `tzOffsetMinutes` follows
// Date.prototype.getTimezoneOffset()'s sign convention (positive west of
// UTC) — pass the value from the client's `x-tz-offset` request header.
export function dayKeyForOffset(now: Date, tzOffsetMinutes: number) {
  const shifted = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

// Mon-Fri -> weekdays; Sat -> saturday; Sun -> sunday.
export function suggestedRoutineTemplateKind(
  d: Date
): Extract<RoutineTemplateKind, "weekdays" | "saturday" | "sunday"> {
  const w = d.getDay();
  if (w === 6) return "saturday";
  if (w === 0) return "sunday";
  return "weekdays";
}
