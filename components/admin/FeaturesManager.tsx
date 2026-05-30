"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FeatureFlag } from "@/app/admin/(protected)/features/page";

const TIERS = [
  {
    key: "free" as const,
    label: "Free",
    color: "emerald",
    border: "border-emerald-500/20",
    activeBg: "bg-emerald-500/10",
    activeText: "text-emerald-300",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-400",
  },
  {
    key: "standard" as const,
    label: "Standard",
    color: "violet",
    border: "border-violet-500/20",
    activeBg: "bg-violet-500/10",
    activeText: "text-violet-300",
    dot: "bg-violet-500",
    badge: "bg-violet-500/15 text-violet-400",
  },
  {
    key: "pro" as const,
    label: "Pro",
    color: "cyan",
    border: "border-cyan-500/20",
    activeBg: "bg-cyan-500/10",
    activeText: "text-cyan-300",
    dot: "bg-cyan-500",
    badge: "bg-cyan-500/15 text-cyan-400",
  },
];

function AddFeatureModal({
  tier,
  onClose,
}: {
  tier: "free" | "standard" | "pro";
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [featureKey, setFeatureKey] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const save = () => {
    if (!name.trim()) { setError("Name is required."); return; }
    start(async () => {
      setError("");
      const res = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, name, description, feature_key: featureKey }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json() as { error: string };
        setError(msg);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  const tierMeta = TIERS.find((t) => t.key === tier)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111118] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierMeta.badge}`}>{tierMeta.label}</span>
          <h2 className="text-base font-semibold text-white">Add feature</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">Feature name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Unlimited exports"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">Description <span className="text-white/25">(optional)</span></label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of the feature"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">
              Feature key <span className="text-white/25">(optional — enables gating)</span>
            </label>
            <input
              value={featureKey}
              onChange={(e) => setFeatureKey(e.target.value)}
              placeholder="e.g. ai_ask, export_pdf"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/30">
              Code checks this key to grant access. Leave blank for a pricing-page-only feature.
            </p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white/80 transition-colors">Cancel</button>
          <button onClick={save} disabled={pending} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50">
            {pending ? "Adding…" : "Add feature"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ flag }: { flag: FeatureFlag }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(flag.enabled);
  const [deleting, setDeleting] = useState(false);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    start(async () => {
      const res = await fetch(`/api/admin/features/${flag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) { setEnabled(!next); }
      else { router.refresh(); }
    });
  };

  const remove = () => {
    start(async () => {
      await fetch(`/api/admin/features/${flag.id}`, { method: "DELETE" });
      router.refresh();
    });
  };

  if (deleting) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
        <p className="text-sm text-white/60">Delete <span className="font-medium text-white/80">{flag.name}</span>?</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleting(false)} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-white/40 hover:text-white/70 transition-colors">Cancel</button>
          <button onClick={remove} disabled={pending} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50">
            {pending ? "…" : "Delete"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 transition-all ${enabled ? "border-white/[0.06] bg-white/[0.02]" : "border-white/[0.03] bg-white/[0.01] opacity-50"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white/80">{flag.name}</p>
          {flag.feature_key && (
            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-400/80">{flag.feature_key}</span>
          )}
        </div>
        {flag.description && <p className="mt-0.5 text-xs text-white/35">{flag.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Toggle */}
        <button
          onClick={toggle}
          disabled={pending}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-violet-600" : "bg-white/15"}`}
          aria-label={enabled ? "Disable" : "Enable"}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
        </button>
        {/* Delete */}
        <button onClick={() => setDeleting(true)} className="rounded-lg p-1.5 text-white/20 hover:text-red-400 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" /><path d="M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function FeaturesManager({ initialFlags }: { initialFlags: FeatureFlag[] }) {
  const [activeTab, setActiveTab] = useState<"free" | "standard" | "pro">("free");
  const [addingFor, setAddingFor] = useState<"free" | "standard" | "pro" | null>(null);

  const flagsForTier = initialFlags.filter((f) => f.tier === activeTab);
  const activeTier = TIERS.find((t) => t.key === activeTab)!;

  return (
    <>
      {/* Tier tabs */}
      <div className="mb-6 flex gap-2">
        {TIERS.map((tier) => {
          const count = initialFlags.filter((f) => f.tier === tier.key).length;
          const isActive = activeTab === tier.key;
          return (
            <button
              key={tier.key}
              onClick={() => setActiveTab(tier.key)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? `${tier.border} ${tier.activeBg} ${tier.activeText}`
                  : "border-white/[0.07] text-white/40 hover:border-white/15 hover:text-white/65"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? tier.dot : "bg-white/20"}`} />
              {tier.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${isActive ? tier.badge : "bg-white/5 text-white/30"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feature list */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white/70">{activeTier.label} tier features</h2>
            <p className="mt-0.5 text-xs text-white/35">{flagsForTier.length} feature{flagsForTier.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => setAddingFor(activeTab)}
            className="flex items-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20 transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add feature
          </button>
        </div>

        <div className="space-y-2 p-4">
          {flagsForTier.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/25">No features yet for this tier.</p>
          ) : (
            flagsForTier.map((flag) => <FeatureRow key={flag.id} flag={flag} />)
          )}
        </div>
      </div>

      {addingFor && (
        <AddFeatureModal tier={addingFor} onClose={() => setAddingFor(null)} />
      )}
    </>
  );
}
