"use client";

import { motion } from "framer-motion";
import { AppShell } from "@/components/dashboard/AppShell";
import { PomodoroApp } from "@/components/pomodoro/PomodoroApp";
import { Loader } from "@/components/ui/Loader";
import { useAuthSession } from "@/lib/useAuthSession";

export default function PomodoroPage() {
  const { session, status } = useAuthSession();
  const user = session?.user ?? null;

  if (status === "loading" || !user) {
    return (
      <AppShell title="Pomodoro">
        <Loader />
      </AppShell>
    );
  }

  return (
    <AppShell title="Pomodoro">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 sm:mb-8"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/90">
          Focus
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Pomodoro
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
          Sessions, breaks, and a local task list in this browser.
          {user?.email && (
            <span className="text-white/25"> · {user.email}</span>
          )}
        </p>
      </motion.div>

      <PomodoroApp />
    </AppShell>
  );
}
