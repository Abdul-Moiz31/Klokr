"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RoutineTemplatesEditor } from "@/components/daily-planner/RoutineTemplatesEditor";
import { Loader } from "@/components/ui/Loader";
import { useDailyPlannerState } from "@/lib/daily-planner/useDailyPlannerState";
import type { User } from "@supabase/supabase-js";

export default function RoutineTemplatesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { state, hydrated, setRoutineTemplate, newId } = useDailyPlannerState();

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      setLoading(false);
    })();
  }, [router]);

  if (loading || !hydrated || !state) {
    return (
      <AppShell title="Routine templates">
        <Loader />
      </AppShell>
    );
  }

  void user;

  return (
    <AppShell title="Routine templates">
      <PageHeader eyebrow="Templates" title="Routine templates" />
      <RoutineTemplatesEditor state={state} setRoutineTemplate={setRoutineTemplate} newIdFn={newId} />
    </AppShell>
  );
}
