import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Routine templates — Klokr",
  description:
    "Fallback, weekday, and weekend task templates to copy into the daily planner.",
};

export default function RoutineTemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
