import { createAdminClient } from "@/lib/supabase-admin";
import { UserGrowthChart } from "@/components/admin/UserGrowthChart";

function getTodayString() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function getDateDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function buildDayRange(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  });
}

function StatCard({ label, value, sub, color = "violet" }: {
  label: string; value: string | number; sub?: string; color?: "violet" | "cyan" | "green";
}) {
  const c = {
    violet: { border: "border-violet-500/20", text: "text-violet-300", dot: "bg-violet-500" },
    cyan:   { border: "border-cyan-500/20",   text: "text-cyan-300",   dot: "bg-cyan-500" },
    green:  { border: "border-emerald-500/20", text: "text-emerald-300", dot: "bg-emerald-500" },
  }[color];

  return (
    <div className={`rounded-xl border ${c.border} bg-white/[0.025] p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">{label}</p>
      </div>
      <p className={`text-3xl font-bold tabular-nums ${c.text}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-white/30">{sub}</p>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const admin = createAdminClient();
  const today = getTodayString();
  const minus7 = getDateDaysAgo(7);
  const minus30 = getDateDaysAgo(30);

  const [
    { data: usersData },
    { data: todaySessions },
    { data: weekSessions },
    { count: totalSessions },
    { count: sessions30d },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("tab_sessions").select("user_id").eq("date", today),
    admin.from("tab_sessions").select("user_id").gte("date", minus7),
    admin.from("tab_sessions").select("*", { count: "exact", head: true }),
    admin.from("tab_sessions").select("*", { count: "exact", head: true }).gte("date", minus30),
  ]);

  const allUsers = usersData?.users ?? [];
  const totalUsers = allUsers.length;
  const newToday = allUsers.filter((u) => u.created_at?.startsWith(today)).length;
  const newThisWeek = allUsers.filter((u) => (u.created_at ?? "") >= minus7).length;
  const dau = new Set((todaySessions ?? []).map((r) => r.user_id)).size;
  const wau = new Set((weekSessions ?? []).map((r) => r.user_id)).size;

  // Cumulative user growth — last 30 days
  const days30 = buildDayRange(30);
  const usersBeforeWindow = allUsers.filter((u) => (u.created_at ?? "") < (days30[0] ?? "")).length;
  const growthData = days30.map((date, i) => {
    const cumulative = usersBeforeWindow + allUsers.filter(
      (u) => (u.created_at ?? "") >= (days30[0] ?? "") && (u.created_at ?? "").slice(0, 10) <= date
    ).length;
    return { date: date.slice(5), total: cumulative, _i: i };
  });

  const now = new Date().toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/30">Admin · Overview</p>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-white/35">{now}</p>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard label="Total users"   value={totalUsers}              color="violet" />
        <StatCard label="New today"     value={newToday}                color="cyan" />
        <StatCard label="New this week" value={newThisWeek}             color="cyan" />
        <StatCard label="DAU"           value={dau}  sub="active today" color="green" />
        <StatCard label="WAU"           value={wau}  sub="last 7 days"  color="green" />
      </div>

      {/* User growth chart */}
      <div className="mb-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-white/70">User growth</p>
            <p className="mt-0.5 text-xs text-white/35">Cumulative registered users — last 30 days</p>
          </div>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
            {totalUsers} total
          </span>
        </div>
        <UserGrowthChart data={growthData} />
      </div>

      {/* Sessions summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/30">Total sessions</p>
          <p className="text-2xl font-bold tabular-nums text-white">{(totalSessions ?? 0).toLocaleString()}</p>
          <p className="mt-1 text-xs text-white/30">All time</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/30">Sessions (30d)</p>
          <p className="text-2xl font-bold tabular-nums text-white">{(sessions30d ?? 0).toLocaleString()}</p>
          <p className="mt-1 text-xs text-white/30">Last 30 days</p>
        </div>
      </div>
    </div>
  );
}
