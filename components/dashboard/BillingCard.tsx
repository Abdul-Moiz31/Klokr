"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";

type PlanTier = "free" | "standard" | "pro";

type Subscription = {
  plan: PlanTier;
  status: string | null;
  currentPeriodEnd: string | null;
  isPaid: boolean;
};

const PLANS: { id: PlanTier; name: string; price: string; features: string[] }[] = [
  { id: "free", name: "Free", price: "$0", features: ["Automatic tab tracking", "7-day history", "Daily dashboard"] },
  { id: "standard", name: "Standard", price: "$5/mo", features: ["Everything in Free", "Unlimited history", "PDF exports", "Weekly review email"] },
  { id: "pro", name: "Pro", price: "$12/mo", features: ["Everything in Standard", "Ask Your Time (AI)", "API access", "Priority support"] },
];

async function authedFetch(path: string, init?: RequestInit) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("not-authed");
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
  });
}

export function BillingCard() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await authedFetch("/api/subscription");
        if (res.ok) {
          const json = await res.json() as { subscription: Subscription };
          setSub(json.subscription);
        }
      } catch { /* leave null → treated as free */ }
      setLoading(false);
    })();
  }, []);

  const currentPlan: PlanTier = sub?.plan ?? "free";

  const upgrade = async (plan: PlanTier) => {
    setBusy(plan);
    try {
      const res = await authedFetch("/api/checkout", { method: "POST", body: JSON.stringify({ plan }) });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) { toast.error(json.error ?? "Could not start checkout."); setBusy(null); return; }
      window.location.assign(json.url);
    } catch {
      toast.error("Could not start checkout.");
      setBusy(null);
    }
  };

  const manage = async () => {
    setBusy("manage");
    try {
      const res = await authedFetch("/api/billing-portal", { method: "POST" });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) { toast.error(json.error ?? "Could not open billing portal."); setBusy(null); return; }
      window.location.assign(json.url);
    } catch {
      toast.error("Could not open billing portal.");
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Plan &amp; billing</p>
      </div>

      {sub?.isPaid && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-emerald-200">
              You&apos;re on {currentPlan === "pro" ? "Pro" : "Standard"}
            </p>
            <p className="mt-0.5 text-xs text-white/45">
              {sub.currentPeriodEnd
                ? `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                : "Active subscription"}
            </p>
          </div>
          <button
            type="button"
            disabled={busy === "manage"}
            onClick={() => void manage()}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-40"
          >
            {busy === "manage" ? "Opening…" : "Manage billing"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = p.id === currentPlan;
          const canUpgrade = !loading && !isCurrent && p.id !== "free" &&
            (currentPlan === "free" || (currentPlan === "standard" && p.id === "pro"));
          return (
            <div
              key={p.id}
              className={`flex flex-col rounded-2xl border p-5 ${
                isCurrent ? "border-violet-500/40 bg-violet-500/[0.06]" : "border-white/[0.08] bg-white/[0.03]"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-white/85">{p.name}</span>
                {isCurrent && <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-200">Current</span>}
              </div>
              <p className="mt-1 text-2xl font-bold text-white">{p.price}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-white/55">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-violet-400/70">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {canUpgrade && (
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => void upgrade(p.id)}
                  className="mt-4 rounded-xl border border-violet-500/30 bg-violet-600/25 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-600/40 disabled:opacity-40"
                >
                  {busy === p.id ? "Redirecting…" : `Upgrade to ${p.name}`}
                </button>
              )}
              {isCurrent && p.id === "free" && (
                <p className="mt-4 text-center text-xs text-white/30">Your current plan</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-white/30">
        Payments are processed securely by Stripe. You can cancel anytime from “Manage billing”.
      </p>
    </div>
  );
}
