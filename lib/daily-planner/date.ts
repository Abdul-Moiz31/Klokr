import type { RoutineTemplateKind } from "./types";

export function dayKey(d: Date) {
  return d.toISOString().split("T")[0]!;
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
