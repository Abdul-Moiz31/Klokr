"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

/**
 * Bumps a counter whenever this user's tab_sessions change (new domain
 * tracked, a heartbeat incrementing an existing row) — via the same Supabase
 * Realtime + 30s polling-fallback pattern already used by the main dashboard
 * list (app/dashboard/page.tsx) and the Daily Planner timeline
 * (useTodaySessions.ts). Doesn't fetch any data itself: callers add the
 * returned value to their own fetch effect's dependency array so their
 * existing query re-runs on live updates, without forcing every card onto
 * one shared query shape (each pulls different columns/date ranges today).
 */
export function useTabSessionsLive(userId: string | null): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`tab_sessions_live:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tab_sessions",
          filter: `user_id=eq.${userId}`,
        },
        () => setTick((t) => t + 1)
      );
    channel.subscribe();

    const pollingInterval = setInterval(() => setTick((t) => t + 1), 30_000);

    return () => {
      clearInterval(pollingInterval);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return tick;
}
