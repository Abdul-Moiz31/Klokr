"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useAuthSession } from "@/lib/useAuthSession";
import { loadPrefs, resolveTimezone } from "@/lib/prefs";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { DomainChart } from "@/components/dashboard/DomainChart";
import { DomainTable } from "@/components/dashboard/DomainTable";
import { DomainDrilldownModal } from "@/components/reports/DomainDrilldownModal";
import { Loader } from "@/components/ui/Loader";
import { WorkDayCompleteBanner } from "@/components/dashboard/WorkDayCompleteBanner";
import { ActivationChecklist } from "@/components/dashboard/ActivationChecklist";
import { PlanVsActualCard } from "@/components/dashboard/PlanVsActualCard";
import { StreakStrip } from "@/components/dashboard/StreakStrip";
import { FocusScoreCard } from "@/components/dashboard/FocusScoreCard";
import { AskYourTime } from "@/components/dashboard/AskYourTime";
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
  const zone = resolveTimezone(loadPrefs());
  try {
    // en-CA gives ISO-shaped "YYYY-MM-DD" via Intl reliably.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().split("T")[0]!;
  }
}


export default function DashboardPage() {
  const { session } = useAuthSession();
  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const [sessions, setSessions] = useState<TabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [drilldown, setDrilldown] = useState<{ domain: string; totalSeconds: number } | null>(null);

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
      channel.subscribe();

      pollingInterval = setInterval(() => {
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

            <StreakStrip userId={userId} />

            <WorkDayCompleteBanner totalSecondsToday={totalSeconds} />
            <PlanVsActualCard sessions={sessions} autoCompleteThreshold={loadPrefs().autoCompleteThreshold} />

            <FocusScoreCard
              domains={domainStats.map((d) => ({ domain: d.domain, totalSeconds: d.totalSeconds }))}
              goalHours={loadPrefs().productiveHoursThreshold}
            />

            <AskYourTime />

            {/* Fetch error banner */}
            {fetchError && (
              <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3">
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

            {/* KPI row */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:mb-10 lg:grid-cols-4">
              <StatsCard
                title="Total time today"
                value={totalSeconds > 0 ? formatTotalTime(totalSeconds) : "0s"}
                tooltip="Sum of all tracked browsing time recorded by the extension today."
                delay={0}
                accent="violet"
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                }
              />
              <StatsCard
                title="Top domain today"
                value={topDomain}
                tooltip="The domain you spent the most time on today."
                delay={0.05}
                accent="cyan"
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                }
              />
              <StatsCard
                title="Domains visited"
                value={domainCount.toString()}
                tooltip="Number of unique domains tracked so far today."
                delay={0.1}
                accent="neutral"
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                }
              />
              <StatsCard
                title="Last synced"
                value={lastSynced ? lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                subtitle={lastSynced ? "Extension connected" : "Install the extension to begin"}
                tooltip="Time of the last successful data sync. The dashboard polls every 30s and also updates instantly when a new session is saved."
                delay={0.15}
                accent="cyan"
                badge={lastSynced ? { label: "● Live", color: "green" } : undefined}
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                }
              />
            </div>

            {sessions.length === 0 ? (
              <ActivationChecklist />
            ) : (
              <div className="space-y-6 lg:space-y-8">
                <DomainChart data={domainStats} totalSeconds={totalSeconds} />
                <DomainTable
                  data={domainStats}
                  onDomainClick={(domain, totalSeconds) =>
                    setDrilldown({ domain, totalSeconds })
                  }
                />
              </div>
            )}
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
