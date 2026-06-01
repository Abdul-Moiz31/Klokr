"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, type TabSession } from "@/lib/supabase";
import { dayKey } from "./date";

/**
 * Fetches tab_sessions for the current user on `forDate`. For today, attaches
 * a Supabase realtime channel and a 30s polling fallback so the fill bars on
 * the planner timeline update live as activity comes in. Past days fetch once.
 *
 * Returns the raw sessions; computation lives in `onTask.ts`.
 */
export function useTodaySessions(forDate: Date | null): {
  sessions: TabSession[];
  loading: boolean;
} {
  const [sessions, setSessions] = useState<TabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const dateK = forDate ? dayKey(forDate) : null;
  const todayK = dayKey(new Date());
  const isToday = dateK !== null && dateK === todayK;

  const fetchSessions = useCallback(async (uid: string, dk: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tab_sessions")
      .select("*")
      .eq("user_id", uid)
      .eq("date", dk)
      .order("start_time", { ascending: true });
    if (error) return;
    setSessions((data ?? []) as TabSession[]);
  }, []);

  useEffect(() => {
    if (!dateK) {
      setSessions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    let pollingInterval: ReturnType<typeof setInterval> | undefined;
    const supabase = createClient();

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) {
          setSessions([]);
          setLoading(false);
        }
        return;
      }

      await fetchSessions(userId, dateK);
      if (cancelled) return;
      setLoading(false);

      if (!isToday) return;

      const channel = supabase
        .channel(`planner_tab_sessions:${userId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tab_sessions",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void fetchSessions(userId, dateK);
          }
        );
      if (cancelled) {
        void supabase.removeChannel(channel);
        return;
      }
      channel.subscribe();

      pollingInterval = setInterval(() => {
        void fetchSessions(userId, dateK);
      }, 30_000);
    })();

    return () => {
      cancelled = true;
      if (pollingInterval) clearInterval(pollingInterval);
      supabase.removeAllChannels();
    };
  }, [dateK, isToday, fetchSessions]);

  return { sessions, loading };
}
