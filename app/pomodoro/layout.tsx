import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pomodoro — Klokr",
  description: "Focus timer with breaks and a quick task list.",
};

export default function PomodoroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
