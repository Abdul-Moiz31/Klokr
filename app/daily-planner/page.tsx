// "use client";
//
// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { createClient } from "@/lib/supabase";
// import { AppShell } from "@/components/dashboard/AppShell";
// import { PageHeader } from "@/components/dashboard/PageHeader";
// import { DailyPlannerApp } from "@/components/daily-planner/DailyPlannerApp";
// import { Loader } from "@/components/ui/Loader";
// import type { User } from "@supabase/supabase-js";
//
// export default function DailyPlannerPage() {
//   const [user, setUser] = useState<User | null>(null);
//   const [loading, setLoading] = useState(true);
//   const router = useRouter();
//
//   useEffect(() => {
//     const supabase = createClient();
//     void (async () => {
//       const { data: { session } } = await supabase.auth.getSession();
//       if (!session) { router.push("/login"); return; }
//       setUser(session.user);
//       setLoading(false);
//     })();
//   }, [router]);
//
//   if (loading) {
//     return (
//       <AppShell title="Daily planner">
//         <Loader />
//       </AppShell>
//     );
//   }
//
//   void user;
//
//   return (
//     <AppShell title="Daily planner">
//       <PageHeader eyebrow="Plan" title="Daily planner" />
//       <DailyPlannerApp />
//     </AppShell>
//   );
// }

// Coming soon — redirect to dashboard until released
import { redirect } from "next/navigation";
export default function DailyPlannerPage() {
  redirect("/dashboard");
}
