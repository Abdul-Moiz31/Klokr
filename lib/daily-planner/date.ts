import type { RoutineTemplateKind } from "./types";

export function dayKey(d: Date) {
  return d.toISOString().split("T")[0]!;
}

/**
 * Mon–Fri → weekdays; Sat–Sun → weekend. Use “Fallback” from the user only.
 */
export function suggestedRoutineTemplateKind(
  d: Date
): Extract<RoutineTemplateKind, "weekdays" | "weekend"> {
  const w = d.getDay();
  return w === 0 || w === 6 ? "weekend" : "weekdays";
}
