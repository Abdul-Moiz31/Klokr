"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RoutineTemplatesEditor } from "@/components/daily-planner/RoutineTemplatesEditor";
import { Loader } from "@/components/ui/Loader";
import { useDailyPlannerState } from "@/lib/daily-planner/useDailyPlannerState";
import { useAuthSession } from "@/lib/useAuthSession";

export default function RoutineTemplatesPage() {
  const { session, status } = useAuthSession();
  const { state, hydrated, setRoutineTemplate, newId } = useDailyPlannerState();

  if (status === "loading" || !session || !hydrated || !state) {
    return (
      <AppShell title="Routine templates">
        <Loader />
      </AppShell>
    );
  }

  return (
    <AppShell title="Routine templates">
      <PageHeader eyebrow="Templates" title="Routine templates" />
      <RoutineTemplatesEditor state={state} setRoutineTemplate={setRoutineTemplate} newIdFn={newId} />
    </AppShell>
  );
}
