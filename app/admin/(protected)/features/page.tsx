import { createAdminClient } from "@/lib/supabase-admin";
import { FeaturesManager } from "@/components/admin/FeaturesManager";

export type FeatureFlag = {
  id: string;
  tier: "free" | "standard" | "pro";
  name: string;
  description: string;
  enabled: boolean;
  sort_order: number;
  created_at: string;
};

export default async function FeaturesPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feature_flags")
    .select("*")
    .order("tier")
    .order("sort_order")
    .order("created_at");

  if (error) {
    return (
      <div className="px-8 py-8">
        <p className="text-red-400 text-sm">
          Failed to load features. Make sure you&apos;ve run migration{" "}
          <code className="font-mono text-white/60">003_feature_flags.sql</code> in your Supabase SQL editor.
        </p>
      </div>
    );
  }

  const flags = (data ?? []) as FeatureFlag[];

  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/30">Admin · Features</p>
        <h1 className="text-2xl font-bold text-white">Features</h1>
        <p className="mt-1 text-sm text-white/35">Manage what features are available per pricing tier</p>
      </div>
      <FeaturesManager initialFlags={flags} />
    </div>
  );
}
