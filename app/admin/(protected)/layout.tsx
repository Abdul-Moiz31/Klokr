import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || !token || token !== secret) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-40 -top-20 h-96 w-96 rounded-full bg-violet-700/8 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-80 w-80 rounded-full bg-cyan-500/6 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      <div className="relative flex h-screen min-h-0">
        <AdminSidebar adminEmail={process.env.ADMIN_EMAIL ?? ""} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
