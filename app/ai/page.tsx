"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AskYourTime } from "@/components/dashboard/AskYourTime";
import { Loader } from "@/components/ui/Loader";
import { useAuthSession } from "@/lib/useAuthSession";

export default function AiInsightsPage() {
  const { session, status } = useAuthSession();
  const user = session?.user ?? null;

  if (status === "loading" || !user) {
    return (
      <AppShell title="AI Insights">
        <Loader />
      </AppShell>
    );
  }

  return (
    <AppShell title="AI Insights">
      <PageHeader
        eyebrow="AI"
        title="Ask your time"
        subtitle="Ask anything about your tracked time — answered from your own data, never shared."
      />
      <div className="max-w-3xl">
        <AskYourTime />
      </div>
    </AppShell>
  );
}
