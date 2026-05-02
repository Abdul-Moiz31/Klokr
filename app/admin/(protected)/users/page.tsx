import { createAdminClient } from "@/lib/supabase-admin";
import { UserManagement, type AdminUser } from "@/components/admin/UserManagement";

function getDateDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export default async function UsersPage() {
  const admin = createAdminClient();
  const minus30 = getDateDaysAgo(30);
  const adminEmail = process.env.ADMIN_EMAIL ?? "";

  const [{ data: usersData }, { data: sessionStats }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("tab_sessions").select("user_id, date").gte("date", minus30),
  ]);

  const byUser: Record<string, { count: number; lastActive: string }> = {};
  for (const row of sessionStats ?? []) {
    if (!byUser[row.user_id]) byUser[row.user_id] = { count: 0, lastActive: row.date };
    byUser[row.user_id].count += 1;
    if (row.date > byUser[row.user_id].lastActive) byUser[row.user_id].lastActive = row.date;
  }

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
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="px-8 py-8">
      <UserManagement users={users} />
    </div>
  );
}
