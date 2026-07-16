import { createAdminClient } from "@/lib/supabase-admin";
import { SettingsControls } from "@/components/admin/SettingsControls";

// ADMIN_SESSION_SECRET is no longer read here — admin sessions are now real,
// per-login, revocable tokens (see lib/admin-auth.ts, migration 017), not a
// single static secret shared by every login.
const ENV_VARS = [
  { key: "NEXT_PUBLIC_SUPABASE_URL",  label: "Supabase URL",      secret: false },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Service Role Key",   secret: true  },
  { key: "ADMIN_EMAIL",               label: "Admin Email",        secret: false },
  { key: "ADMIN_PASSWORD",            label: "Admin Password",     secret: true  },
];

// Fully redacted, no partial reveal — ADMIN_PASSWORD is the sole credential
// gating the entire admin surface (full user data, purge-sessions, plan
// grants), and any character-level exposure here (screen-share, screenshot,
// a browser extension reading the DOM) measurably shrinks its real-world
// brute-force search space. "Configured or not" is all this diagnostics
// table needs to convey — it doesn't need to prove which characters are set.
function mask() {
  return "••••••••••••";
}

export default async function SettingsPage() {
  const admin = createAdminClient();

  const [
    { data: usersData },
    { count: totalSessions },
    { count: sessions90d },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("tab_sessions").select("*", { count: "exact", head: true }),
    admin.from("tab_sessions").select("*", { count: "exact", head: true })
      .lt("date", (() => {
        const d = new Date(); d.setDate(d.getDate() - 90);
        return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
      })()),
  ]);

  const totalUsers = usersData?.users.length ?? 0;
  const bannedUsers = usersData?.users.filter(
    (u) => u.banned_until && new Date(u.banned_until) > new Date()
  ).length ?? 0;

  const exportRows = (usersData?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    name: (u.user_metadata?.full_name as string | undefined) ?? "",
    provider: (u.app_metadata?.provider as string | undefined) ?? "email",
    created_at: u.created_at ?? "",
    banned: String(Boolean(u.banned_until && new Date(u.banned_until) > new Date())),
  }));

  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/30">Admin · Settings</p>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/35">Configuration, controls, and app status</p>
      </div>

      {/* App stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "Total users", value: totalUsers },
          { label: "Restricted users", value: bannedUsers },
          { label: "Total sessions", value: (totalSessions ?? 0).toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25">{label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Interactive controls */}
      <SettingsControls
        sessions90dCount={sessions90d ?? 0}
        exportRows={exportRows}
      />

      {/* Env status */}
      <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
        <div className="border-b border-white/[0.05] px-6 py-4">
          <h2 className="text-sm font-semibold text-white/70">Environment variables</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.05]">
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/25">Variable</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/25">Value</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/25">Status</th>
            </tr>
          </thead>
          <tbody>
            {ENV_VARS.map(({ key, label, secret }, i) => {
              const value = process.env[key];
              const set = Boolean(value);
              return (
                <tr key={key} className={`border-b border-white/[0.04] ${i === ENV_VARS.length - 1 ? "border-b-0" : ""}`}>
                  <td className="px-6 py-3.5">
                    <p className="text-white/65">{label}</p>
                    <p className="font-mono text-[11px] text-white/25">{key}</p>
                  </td>
                  <td className="px-6 py-3.5 font-mono text-xs text-white/35">
                    {set ? (secret ? mask() : value) : <span className="text-red-400/60">not set</span>}
                  </td>
                  <td className="px-6 py-3.5">
                    {set ? (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Set
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />Missing
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Danger info */}
      <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/5 p-5">
        <p className="mb-1 text-sm font-medium text-amber-300/80">To change credentials</p>
        <p className="text-sm text-white/40">
          Update <span className="font-mono text-white/55">ADMIN_EMAIL</span> or{" "}
          <span className="font-mono text-white/55">ADMIN_PASSWORD</span> in your{" "}
          <span className="font-mono text-white/55">.env</span> file and redeploy — this only
          affects future logins. Each login now creates its own revocable session; use Log Out
          to end the current one, or clear the <span className="font-mono text-white/55">admin_sessions</span> table
          to revoke every active session at once.
        </p>
      </div>
    </div>
  );
}
