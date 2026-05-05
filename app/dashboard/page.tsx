"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { DomainChart } from "@/components/dashboard/DomainChart";
import { DomainTable } from "@/components/dashboard/DomainTable";
import { DomainDrilldownModal } from "@/components/reports/DomainDrilldownModal";
import { Loader } from "@/components/ui/Loader";
import { getSiteName } from "@/lib/domain";
import type { TabSession } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface DomainStat {
  domain: string;
  pageTitle: string;
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
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}


export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<TabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [drilldown, setDrilldown] = useState<{ domain: string; totalSeconds: number } | null>(null);
  const router = useRouter();

  const fetchSessions = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tab_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("date", getTodayString())
      .order("duration_seconds", { ascending: false });

    if (!error && data) {
      setSessions(data as TabSession[]);
      setLastSynced(new Date());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollingInterval: ReturnType<typeof setInterval> | undefined;
    const supabase = createClient();

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      if (cancelled) return;

      // Use getUser() for a live server fetch so admin-updated metadata is always fresh
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      if (cancelled) return;

      setUser(user);
      await fetchSessions(user.id);
      if (cancelled) return;
      setLoading(false);

      // Listen to both INSERT (new domain first seen today) and UPDATE
      // (heartbeat incrementing duration on an existing row) so the dashboard
      // refreshes in real-time throughout the session, not just on first visit.
      const channel = supabase
        .channel(`tab_sessions:${user.id}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tab_sessions",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void fetchSessions(user.id);
          }
        );

      if (cancelled) {
        void supabase.removeChannel(channel);
        return;
      }
      channel.subscribe();

      if (cancelled) {
        void supabase.removeChannel(channel);
        return;
      }

      pollingInterval = setInterval(() => {
        void fetchSessions(user.id);
      }, 30_000);
    })();

    return () => {
      cancelled = true;
      if (pollingInterval) clearInterval(pollingInterval);
      supabase.removeAllChannels();
    };
  }, [router, fetchSessions]);

  const domainStats: DomainStat[] = Object.values(
    sessions.reduce(
      (acc, session) => {
        const domain = session.domain;
        if (!acc[domain]) {
          acc[domain] = {
            domain,
            pageTitle: session.page_title ?? domain,
            totalSeconds: 0,
            visits: 0,
            hours: 0,
            minutes: 0,
          };
        }
        acc[domain].totalSeconds += session.duration_seconds;
        // Use stored visit count from the upserted row, not row count.
        acc[domain].visits += session.visits ?? 1;
        // Keep page_title from the session with most duration.
        if (session.duration_seconds > (acc[domain].totalSeconds - session.duration_seconds)) {
          acc[domain].pageTitle = session.page_title ?? domain;
        }
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
    ? getSiteName(domainStats[0].domain, domainStats[0].pageTitle)
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
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center sm:p-14"
              >
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-cyan-500/10 text-3xl">
                  ⏱️
                </div>
                <h3 className="mb-2 text-xl font-semibold text-white sm:text-2xl">
                  No data yet for today
                </h3>
                <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-white/45">
                  Keep the Klokrs extension enabled and use Chrome as usual. Time
                  per domain will show up here as sessions sync—usually within a
                  few seconds of browsing.
                </p>
                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                  <Link
                    href="/daily-planner"
                    className="inline-flex min-w-[10rem] items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                  >
                    Open daily planner
                  </Link>
                  <Link
                    href="/pomodoro"
                    className="inline-flex min-w-[10rem] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10"
                  >
                    Pomodoro
                  </Link>
                </div>
              </motion.div>
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
