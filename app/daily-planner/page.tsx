"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DailyPlannerApp } from "@/components/daily-planner/DailyPlannerApp";
import { Loader } from "@/components/ui/Loader";
import { useAuthSession } from "@/lib/useAuthSession";

export default function DailyPlannerPage() {
  const { session, status } = useAuthSession();

  if (status === "loading" || !session) {
    return (
      <AppShell title="Daily planner">
        <Loader />
      </AppShell>
    );
  }

  return (
    <AppShell title="Daily planner">
      <PageHeader eyebrow="Plan" title="Daily planner" />
      <DailyPlannerApp accountCreatedAt={session.user.created_at ?? null} />
    </AppShell>
  );
}
