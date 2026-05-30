import { createAdminClient } from "@/lib/supabase-admin";
import { UserManagement, type AdminUser, type PlanTier } from "@/components/admin/UserManagement";
import { isPaidStatus } from "@/lib/stripe";

// Resolve effective plan: a manual grant wins over Stripe; otherwise the Stripe
// plan only counts while the subscription is in a paid status.
function resolvePlan(row: { plan?: string | null; manual_plan?: string | null; status?: string | null } | undefined): {
  plan: PlanTier;
  manualPlan: PlanTier | null;
} {
  const manual = (row?.manual_plan as PlanTier | null) ?? null;
  if (manual && manual !== "free") return { plan: manual, manualPlan: manual };
  const paid = isPaidStatus(row?.status ?? null);
  return { plan: paid ? ((row?.plan as PlanTier) ?? "free") : "free", manualPlan: manual };
}

function getDateDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export default async function UsersPage() {
  const admin = createAdminClient();
  const minus30 = getDateDaysAgo(30);
  const adminEmail = process.env.ADMIN_EMAIL ?? "";

  const [{ data: usersData }, { data: sessionStats }, { data: subsData }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("tab_sessions").select("user_id, date").gte("date", minus30),
    admin.from("subscriptions").select("user_id, plan, manual_plan, status"),
  ]);

  const byUser: Record<string, { count: number; lastActive: string }> = {};
  for (const row of sessionStats ?? []) {
    if (!byUser[row.user_id]) byUser[row.user_id] = { count: 0, lastActive: row.date };
    byUser[row.user_id].count += 1;
    if (row.date > byUser[row.user_id].lastActive) byUser[row.user_id].lastActive = row.date;
  }

  const subByUser: Record<string, { plan?: string | null; manual_plan?: string | null; status?: string | null }> = {};
  for (const s of subsData ?? []) subByUser[s.user_id] = s;

  const users: AdminUser[] = (usersData?.users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? "—",
      name: (u.user_metadata?.full_name as string | undefined) ?? "",
      provider: (u.app_metadata?.provider as string | undefined) ?? "email",
      created_at: u.created_at ?? "",
      sessions30d: byUser[u.id]?.count ?? 0,
      lastActive: byUser[u.id]?.lastActive ?? null,
      banned: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
      isAdmin: u.email === adminEmail,
      ...resolvePlan(subByUser[u.id]),
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="px-8 py-8">
      <UserManagement users={users} />
    </div>
  );
}
