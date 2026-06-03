"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAuthSession } from "@/lib/useAuthSession";
import { createClient } from "@/lib/supabase";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ActivityHeatmap, type DayStat } from "@/components/activity/ActivityHeatmap";
import { DayReportModal } from "@/components/activity/DayReportModal";
import { DomainTable } from "@/components/dashboard/DomainTable";
import { DomainDrilldownModal } from "@/components/reports/DomainDrilldownModal";
import { loadPrefs } from "@/lib/prefs";
import { Loader } from "@/components/ui/Loader";
import { calcForgivingStreak, localDateStr } from "@/lib/streak";

interface TodayDomain {
  domain: string;
  totalSeconds: number;
  visits: number;
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}


export default function ActivityPage() {
  const { session: authSession } = useAuthSession();
  const user = authSession?.user ?? null;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DayStat[]>([]);
  const [todayDomains, setTodayDomains] = useState<TodayDomain[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSeconds, setSelectedSeconds] = useState(0);
  const [drilldown, setDrilldown] = useState<{ domain: string; totalSeconds: number } | null>(null);
  const userIdRef = useRef<string | null>(null);

  const prefs = useMemo(() => loadPrefs(), []);
  const thresholdS = prefs.productiveHoursThreshold * 3600;

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => localDateStr(today), [today]);

  const fetchStats = useCallback(async (userId: string) => {
    const from = new Date(today);
    from.setDate(today.getDate() - 90);
    const fromStr = localDateStr(from);

    const supabase = createClient();
    const { data } = await supabase
      .from("tab_sessions")
      .select("date, duration_seconds")
      .eq("user_id", userId)
      .gte("date", fromStr)
      .lte("date", todayStr)
      .gte("duration_seconds", prefs.minSessionSeconds);

    if (!data) return;

    // Aggregate by date
    const map = new Map<string, number>();
    for (const row of data) {
      map.set(row.date, (map.get(row.date) ?? 0) + row.duration_seconds);
    }

    const rows: DayStat[] = Array.from(map.entries()).map(([date, totalSeconds]) => ({
      date,
      totalSeconds,
    }));
    setStats(rows);

    // Today's per-domain breakdown — the full tracking list lives here now.
    const { data: todayRows } = await supabase
      .from("tab_sessions")
      .select("domain, duration_seconds, visits")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .order("duration_seconds", { ascending: false });

    if (todayRows) {
      const domainMap = new Map<string, { totalSeconds: number; visits: number }>();
      for (const row of todayRows) {
        const cur = domainMap.get(row.domain) ?? { totalSeconds: 0, visits: 0 };
        cur.totalSeconds += row.duration_seconds;
        cur.visits += row.visits ?? 1;
        domainMap.set(row.domain, cur);
      }
      setTodayDomains(
        Array.from(domainMap.entries())
          .map(([domain, v]) => ({ domain, ...v }))
          .sort((a, b) => b.totalSeconds - a.totalSeconds)
      );
    }
  }, [today, todayStr]);

  useEffect(() => {
    if (!user) return;
    userIdRef.current = user.id;
    void (async () => {
      await fetchStats(user.id);
      setLoading(false);
    })();
  }, [user, fetchStats]);

  // Re-fetch when the user switches back to this tab after being away.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && userIdRef.current) {
        void fetchStats(userIdRef.current);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchStats]);

  // Derived stats
  const dailyMap = useMemo(() => new Map(stats.map((s) => [s.date, s.totalSeconds])), [stats]);

  const totalTrackedSeconds = useMemo(() => stats.reduce((s, d) => s + d.totalSeconds, 0), [stats]);

  const productiveDays = useMemo(
    () => stats.filter((d) => d.totalSeconds >= thresholdS).length,
    [stats, thresholdS]
  );

  const streak = useMemo(
    () => calcForgivingStreak(dailyMap, todayStr).count,
    [dailyMap, todayStr]
  );

  const bestDay = useMemo(() => {
    if (stats.length === 0) return null;
    return stats.reduce((best, cur) => cur.totalSeconds > best.totalSeconds ? cur : best);
  }, [stats]);

  const handleDayClick = useCallback((date: string, seconds: number) => {
    setSelectedDate(date);
    setSelectedSeconds(seconds);
  }, []);

  if (loading) {
    return (
      <AppShell title="Activity">
        <Loader />
      </AppShell>
    );
  }

  return (
    <AppShell title="Activity">
      <PageHeader eyebrow="Overview · Last 90 days" title="Activity" />

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 lg:grid-cols-4 lg:gap-4">
        <StatsCard
          title="Total tracked"
          value={totalTrackedSeconds > 0 ? formatTime(totalTrackedSeconds) : "0s"}
          subtitle="Last 90 days"
          tooltip="Sum of all browsing time recorded by the extension over the last 90 days."
          accent="violet"
          delay={0}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
          }
        />
        <StatsCard
          title="Productive days"
          value={`${productiveDays}`}
          subtitle={`of ${stats.length} days tracked`}
          tooltip={`Days where you hit your ${prefs.productiveHoursThreshold}h productivity goal. Adjust the threshold in Settings → Preferences.`}
          accent="cyan"
          delay={0.05}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
            </svg>
          }
        />
        <StatsCard
          title="Current streak"
          value={`${streak}d`}
          subtitle={streak > 0 ? "days in a row (1 miss forgiven)" : "Start your streak today"}
          tooltip="Days with tracked browsing, ending today (or yesterday if you haven't browsed yet). Forgiving: a single missed day won't break it — only two misses in a row will."
          accent={streak >= 7 ? "violet" : "neutral"}
          delay={0.1}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
        />
        <StatsCard
          title="Best day"
          value={bestDay ? formatTime(bestDay.totalSeconds) : "—"}
          subtitle={bestDay ? new Date(bestDay.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No data yet"}
          tooltip="The single day with the highest total tracked browsing time in the last 90 days."
          accent="neutral"
          delay={0.15}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
        />
      </div>

      {/* Heatmap */}
      <ActivityHeatmap
        stats={stats}
        productiveThresholdSeconds={thresholdS}
        todayStr={todayStr}
        streak={streak}
        productiveDays={productiveDays}
        bestDayStr={bestDay?.date ?? null}
        onDayClick={handleDayClick}
      />

      {/* Today's full domain breakdown */}
      {todayDomains.length > 0 && (
        <div className="mt-6 sm:mt-8">
          <DomainTable
            data={todayDomains}
            onDomainClick={(domain, totalSeconds) => setDrilldown({ domain, totalSeconds })}
          />
        </div>
      )}

      {/* Day report modal */}
      {user && (
        <DayReportModal
          date={selectedDate}
          userId={user.id}
          productiveThresholdSeconds={thresholdS}
          streak={streak}
          productiveDays={productiveDays}
          totalDays={stats.length}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {/* Domain drill-down for today */}
      {drilldown && (
        <DomainDrilldownModal
          domain={drilldown.domain}
          startDate={todayStr}
          endDate={todayStr}
          isDaily
          totalSeconds={drilldown.totalSeconds}
          onClose={() => setDrilldown(null)}
        />
      )}
    </AppShell>
  );
}
