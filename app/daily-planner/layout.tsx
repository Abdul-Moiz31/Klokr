import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily planner — Tably",
  description:
    "Routines, task dump, domain-tagged tasks, and tab time attribution.",
};

export default function DailyPlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
