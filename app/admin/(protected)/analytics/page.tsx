import { createAdminClient } from "@/lib/supabase-admin";
import { SignupsChart } from "@/components/admin/SignupsChart";
import { SessionsChart } from "@/components/admin/SessionsChart";
import { TopDomainsChart } from "@/components/admin/TopDomainsChart";

function getDateDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function buildDayRange(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  });
}

export default async function AnalyticsPage() {
  const admin = createAdminClient();
  const minus30 = getDateDaysAgo(30);
  const minus14 = getDateDaysAgo(14);

  const [{ data: usersData }, { data: sessions30d }, { data: topDomainsRaw }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("tab_sessions").select("user_id, date").gte("date", minus14),
    admin.from("tab_sessions").select("domain, duration_seconds").gte("date", minus30),
  ]);

  // Signups per day — last 30 days
  const days30 = buildDayRange(30);
  const signupsByDay: Record<string, number> = {};
  days30.forEach((d) => (signupsByDay[d] = 0));
  for (const u of usersData?.users ?? []) {
    const day = u.created_at?.slice(0, 10);
    if (day && signupsByDay[day] !== undefined) signupsByDay[day]++;
  }
  const signupsData = days30.map((date) => ({
    date: date.slice(5), // MM-DD
    signups: signupsByDay[date],
  }));

  // DAU per day — last 14 days
  const days14 = buildDayRange(14);
  const dauByDay: Record<string, Set<string>> = {};
  days14.forEach((d) => (dauByDay[d] = new Set()));
  for (const s of sessions30d ?? []) {
    if (dauByDay[s.date]) dauByDay[s.date].add(s.user_id);
  }
  const dauData = days14.map((date) => ({
    date: date.slice(5),
    dau: dauByDay[date]?.size ?? 0,
  }));

  // Top 10 domains by total time — last 30 days
  const domainTotals: Record<string, number> = {};
  for (const s of topDomainsRaw ?? []) {
    domainTotals[s.domain] = (domainTotals[s.domain] ?? 0) + s.duration_seconds;
  }
  const topDomains = Object.entries(domainTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, seconds]) => ({ domain, hours: Math.round(seconds / 3600 * 10) / 10 }));

  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/30">Admin · Analytics</p>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-white/35">Last 30 days</p>
      </div>

      <div className="space-y-6">
        {/* Signups */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
          <p className="mb-1 text-sm font-semibold text-white/70">New signups</p>
          <p className="mb-5 text-xs text-white/35">Daily new users — last 30 days</p>
          <SignupsChart data={signupsData} />
        </div>

        {/* DAU */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
          <p className="mb-1 text-sm font-semibold text-white/70">Daily active users (DAU)</p>
          <p className="mb-5 text-xs text-white/35">Distinct users with at least one session — last 14 days</p>
          <SessionsChart data={dauData} />
        </div>

        {/* Top domains */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
          <p className="mb-1 text-sm font-semibold text-white/70">Top domains across all users</p>
          <p className="mb-5 text-xs text-white/35">Total hours tracked per domain — last 30 days</p>
          <TopDomainsChart data={topDomains} />
        </div>
      </div>
    </div>
  );
}
