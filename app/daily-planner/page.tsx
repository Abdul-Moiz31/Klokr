"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DailyPlannerApp } from "@/components/daily-planner/DailyPlannerApp";
import { Loader } from "@/components/ui/Loader";
import type { User } from "@supabase/supabase-js";

export default function DailyPlannerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <AppShell title="Daily planner">
        <Loader />
      </AppShell>
    );
  }

  void user;

  return (
    <AppShell title="Daily planner">
      <PageHeader eyebrow="Plan" title="Daily planner" />
      <DailyPlannerApp />
    </AppShell>
  );
}
