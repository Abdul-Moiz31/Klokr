"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useAuthSession } from "@/lib/useAuthSession";
import { loadPrefs, getDayPhase, getLocalDateString } from "@/lib/prefs";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DomainChart } from "@/components/dashboard/DomainChart";
import { TopDomains } from "@/components/dashboard/TopDomains";
import { TodayActivityChart } from "@/components/dashboard/TodayActivityChart";
import { DomainDrilldownModal } from "@/components/reports/DomainDrilldownModal";
import { Loader } from "@/components/ui/Loader";
import { WorkDayCompleteBanner } from "@/components/dashboard/WorkDayCompleteBanner";
import { ActivationChecklist } from "@/components/dashboard/ActivationChecklist";
import { NoActivityToday } from "@/components/dashboard/NoActivityToday";
import { PlanVsActualCard } from "@/components/dashboard/PlanVsActualCard";
import { CurrentTaskCard, useActiveScheduledTask } from "@/components/dashboard/CurrentTaskCard";
import { useAutoCompleteTasks } from "@/lib/daily-planner/useAutoCompleteTasks";
import { StreakStrip } from "@/components/dashboard/StreakStrip";
import { AccountabilityCard } from "@/components/dashboard/AccountabilityCard";
import { WeeklyReviewCard } from "@/components/dashboard/WeeklyReviewCard";
import { FocusScoreCard } from "@/components/dashboard/FocusScoreCard";
import { getSiteName } from "@/lib/domain";
import type { TabSession } from "@/lib/supabase";

interface DomainStat {
  domain: string;
  totalSeconds: number;
  visits: number;
  hours: number;
  minutes: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatTotalTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getTodayString() {
  return getLocalDateString(loadPrefs());
}


export default function DashboardPage() {
  const { session } = useAuthSession();
  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const [sessions, setSessions] = useState<TabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  // Distinguishes "brand new user, never tracked anything" from "returning
  // user, just no data for today yet" — the two need very different empty
  // states. null = not checked yet, so we don't flash the wrong one.
  const [hasEverTracked, setHasEverTracked] = useState<boolean | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [drilldown, setDrilldown] = useState<{ domain: string; totalSeconds: number } | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const activeTask = useActiveScheduledTask(sessions, loadPrefs().autoCompleteThreshold);
  useAutoCompleteTasks(sessions, loadPrefs());

  const fetchSessions = useCallback(async (uid: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tab_sessions")
      .select("*")
      .eq("user_id", uid)
      .eq("date", getTodayString())
      .order("duration_seconds", { ascending: false });

    if (error) {
      setFetchError(true);
      return;
    }
    setFetchError(false);
    setSessions(data as TabSession[]);
    setLastSynced(new Date());
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let pollingInterval: ReturnType<typeof setInterval> | undefined;
    const supabase = createClient();

    void (async () => {
      await fetchSessions(userId);
      if (cancelled) return;
      setLoading(false);

      // One-off, not date-filtered — just enough to know if this user has
      // ever synced a session, so the empty state doesn't tell a long-time
      // user to "add the extension" every single morning before today's
      // first heartbeat lands.
      const { count } = await supabase
        .from("tab_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .limit(1);
      if (!cancelled) setHasEverTracked((count ?? 0) > 0);

      // Listen to both INSERT (new domain first seen today) and UPDATE
      // (heartbeat incrementing duration on an existing row) so the dashboard
      // refreshes in real-time throughout the session, not just on first visit.
      const channel = supabase
        .channel(`tab_sessions:${userId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tab_sessions",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void fetchSessions(userId);
          }
        );

      if (cancelled) {
        void supabase.removeChannel(channel);
        return;
      }
      // Track whether the realtime channel is actually confirmed healthy —
      // the poll below only does real work while it isn't, instead of
      // unconditionally re-fetching every 30s regardless of whether
      // realtime is already delivering updates. Worst case (realtime never
      // confirms healthy — a blocked websocket, a dropped connection with
      // no clean error) this is identical to the old always-poll behavior;
      // it only becomes a no-op when realtime is genuinely working.
      let isRealtimeHealthy = false;
      channel.subscribe((status: string) => {
        isRealtimeHealthy = status === "SUBSCRIBED";
      });

      pollingInterval = setInterval(() => {
        if (isRealtimeHealthy) return;
        void fetchSessions(userId);
      }, 30_000);
    })();

    return () => {
      cancelled = true;
      if (pollingInterval) clearInterval(pollingInterval);
      supabase.removeAllChannels();
    };
  }, [userId, fetchSessions]);

  const domainStats: DomainStat[] = Object.values(
    sessions.reduce(
      (acc, session) => {
        const domain = session.domain;
        if (!acc[domain]) {
          acc[domain] = {
            domain,
            totalSeconds: 0,
            visits: 0,
            hours: 0,
            minutes: 0,
          };
        }
        acc[domain].totalSeconds += session.duration_seconds;
        acc[domain].visits += session.visits ?? 1;
        return acc;
      },
      {} as Record<string, DomainStat>
    )
  )
    .map((d) => ({
      ...d,
      hours: Math.floor(d.totalSeconds / 3600),
      minutes: Math.floor((d.totalSeconds % 3600) / 60),
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const topDomain = domainStats[0]
    ? getSiteName(domainStats[0].domain)
    : "—";
  const domainCount = domainStats.length;
  const displayName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "there";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <Loader />
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard">
      <PageHeader
        eyebrow="Overview · Today"
        title={`${getGreeting()},`}
        titleHighlight={displayName}
        subtitle={today}
        actions={
          <>
            {lastSynced && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 backdrop-blur-sm">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Synced {lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            )}
            <Link
              href="/daily-planner"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white"
            >
              Daily planner
            </Link>
          </>
        }
      />

      <div className="space-y-5">
            <WorkDayCompleteBanner totalSecondsToday={totalSeconds} />

            {/* Gamification headline — accountability score, level, streak */}
            <AccountabilityCard userId={userId} />

            {/* Fetch error banner */}
            {fetchError && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3">
                <p className="text-sm text-red-400/90">Failed to load session data. Check your connection and try again.</p>
                <button
                  type="button"
                  onClick={() => user && void fetchSessions(user.id)}
                  className="shrink-0 rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Hero stat strip — total time is the one number that matters most; everything
                else is a smaller inline chip so the eye has a single anchor point. */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
              <div>
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Total time today</p>
                <p className="bg-gradient-to-br from-violet-200 to-white bg-clip-text text-3xl font-bold leading-none tracking-tight text-transparent tabular-nums">
                  {totalSeconds > 0 ? formatTotalTime(totalSeconds) : "0s"}
                </p>
              </div>

              <div className="hidden h-9 w-px bg-white/[0.08] sm:block" />

              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Top domain</p>
                <p className="max-w-[10rem] truncate text-sm font-semibold text-white/80">{topDomain}</p>
              </div>

              <div className="hidden h-9 w-px bg-white/[0.08] sm:block" />

              <div>
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Domains</p>
                <p className="text-sm font-semibold text-white/80 tabular-nums">{domainCount}</p>
              </div>

              <div className="hidden h-9 w-px bg-white/[0.08] sm:block" />

              <div className="flex items-center gap-1.5">
                {lastSynced && (
                  <span className="relative flex h-1.5 w-1.5" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                )}
                <div>
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Last synced</p>
                  <p className="text-sm font-semibold text-white/80 tabular-nums">
                    {lastSynced ? lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Insights — collapsed by default so the page opens on one focal point. */}
            <section>
              <button
                type="button"
                onClick={() => setShowInsights((v) => !v)}
                className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-white/35 transition hover:text-white/60"
              >
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform ${showInsights ? "rotate-90" : ""}`}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                More insights
              </button>
              {showInsights && (
                <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <StreakStrip userId={userId} />
                  <WeeklyReviewCard userId={userId} />
                  <PlanVsActualCard sessions={sessions} autoCompleteThreshold={loadPrefs().autoCompleteThreshold} />
                  <FocusScoreCard
                    domains={domainStats.map((d) => ({ domain: d.domain, totalSeconds: d.totalSeconds }))}
                    goalHours={loadPrefs().productiveHoursThreshold}
                  />
                </div>
              )}
            </section>

            {sessions.length === 0 && !activeTask ? (
              hasEverTracked ? (
                <NoActivityToday dayPhase={getDayPhase(loadPrefs())} workStartHour={loadPrefs().workStartHour} />
              ) : hasEverTracked === false ? (
                <ActivationChecklist />
              ) : null
            ) : (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/35">Activity</h2>
                <div className="space-y-5">
                  {activeTask ? (
                    <CurrentTaskCard active={activeTask} />
                  ) : (
                    <TodayActivityChart sessions={sessions} />
                  )}
                  {sessions.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <DomainChart data={domainStats} totalSeconds={totalSeconds} />
                      <TopDomains
                        data={domainStats}
                        onDomainClick={(domain, totalSeconds) =>
                          setDrilldown({ domain, totalSeconds })
                        }
                      />
                    </div>
                  )}
                </div>
              </section>
            )}
      </div>
      {drilldown && (
        <DomainDrilldownModal
          domain={drilldown.domain}
          startDate={getTodayString()}
          endDate={getTodayString()}
          isDaily
          totalSeconds={drilldown.totalSeconds}
          onClose={() => setDrilldown(null)}
        />
      )}
    </AppShell>
  );
}
