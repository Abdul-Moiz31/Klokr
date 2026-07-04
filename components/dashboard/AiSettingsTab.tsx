"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";

type Provider = "anthropic" | "openai" | "gemini" | "openrouter" | "groq";

type Quota = {
  plan: "free" | "standard" | "pro";
  used: number;
  limit: number;
  remaining: number;
  hasOwnKey: boolean;
};

type KeyStatus = {
  hasOwnKey: boolean;
  provider: Provider;
  quota: Quota;
};

const PROVIDERS: {
  value: Provider;
  label: string;
  placeholder: string;
  description: string;
  url: string;
  color: string;
}[] = [
  {
    value: "anthropic",
    label: "Anthropic",
    placeholder: "sk-ant-api03-...",
    description: "Claude Opus — best reasoning, deepest insights",
    url: "https://console.anthropic.com",
    color: "from-violet-500/20 to-purple-500/10 border-violet-500/30",
  },
  {
    value: "openai",
    label: "OpenAI",
    placeholder: "sk-proj-...",
    description: "GPT-4o mini — fast, affordable, great for Q&A",
    url: "https://platform.openai.com/api-keys",
    color: "from-emerald-500/15 to-teal-500/10 border-emerald-500/25",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    placeholder: "AIzaSy...",
    description: "Gemini 1.5 Flash — lightweight and free tier available",
    url: "https://aistudio.google.com/apikey",
    color: "from-blue-500/15 to-cyan-500/10 border-blue-500/25",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    placeholder: "sk-or-v1-...",
    description: "Access 100+ models — pay per use, one key",
    url: "https://openrouter.ai/settings/keys",
    color: "from-amber-500/15 to-orange-500/10 border-amber-500/25",
  },
  {
    value: "groq",
    label: "Groq",
    placeholder: "gsk_...",
    description: "Llama 3.3 70B — extremely fast, generous free tier",
    url: "https://console.groq.com/keys",
    color: "from-rose-500/15 to-red-500/10 border-rose-500/25",
  },
];

async function authedFetch(path: string, init?: RequestInit) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("not-authed");
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

function SectionTitle({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="mb-4 flex items-center gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{children}</p>
      {tooltip && <span className="text-[10px] text-white/25">— {tooltip}</span>}
    </div>
  );
}

export function AiSettingsTab() {
  const [status, setStatus]     = useState<KeyStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Provider>("anthropic");
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy]         = useState(false);
  const [showInput, setShowInput] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await authedFetch("/api/ai-key");
      if (res.ok) {
        const data = await res.json() as KeyStatus;
        setStatus(data);
        setSelected(data.provider ?? "anthropic");
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authedFetch("/api/ai-key");
        if (!cancelled && res.ok) {
          const data = await res.json() as KeyStatus;
          setStatus(data);
          setSelected(data.provider ?? "anthropic");
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const saveKey = async () => {
    if (keyInput.trim().length < 10) { toast.error("Enter a valid API key."); return; }
    setBusy(true);
    try {
      const res = await authedFetch("/api/ai-key", {
        method: "POST",
        body: JSON.stringify({ provider: selected, key: keyInput.trim() }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { toast.error(json.error ?? "Could not save key."); setBusy(false); return; }
      setKeyInput("");
      setShowInput(false);
      await refresh();
      toast.success("API key saved.");
    } catch { toast.error("Could not save key."); }
    setBusy(false);
  };

  const removeKey = async () => {
    setBusy(true);
    try {
      await authedFetch("/api/ai-key", { method: "DELETE" });
      await refresh();
      toast.success("API key removed.");
    } catch { toast.error("Could not remove key."); }
    setBusy(false);
  };

  if (loading || !status) {
    return <div className="py-8 text-center text-sm text-white/30">Loading…</div>;
  }

  const { quota, hasOwnKey } = status;
  const pct = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
  const activeProvider = PROVIDERS.find((p) => p.value === status.provider);

  return (
    <div className="space-y-5">

      {/* Usage meter */}
      <div>
        <SectionTitle>AI Usage</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-1">
          {hasOwnKey ? (
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-white/80">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  {activeProvider?.label ?? "Custom"} key active
                </p>
                <p className="mt-0.5 text-xs text-white/40">Unlimited AI queries — billed directly to your provider account.</p>
              </div>
              <button
                type="button"
                onClick={() => void removeKey()}
                disabled={busy}
                className="shrink-0 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
              >
                Remove key
              </button>
            </div>
          ) : (
            <div className="py-3.5">
              <div className="flex items-center justify-between text-xs text-white/45 mb-2">
                <span>Klokrs AI quota this month ({quota.plan} plan)</span>
                <span className="tabular-nums font-medium text-white/60">{quota.used} / {quota.limit}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full transition-all ${quota.remaining === 0 ? "bg-amber-400/70" : "bg-violet-400/70"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {quota.remaining === 0 && (
                <p className="mt-2 text-xs text-amber-400/80">Quota reached. Add your own key below for unlimited use.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Provider selection */}
      <div>
        <SectionTitle tooltip="Choose a provider and add your key for unlimited queries">AI Provider</SectionTitle>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const isActive = hasOwnKey && status.provider === p.value;
            const isChosen = !hasOwnKey && selected === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => { if (!hasOwnKey) { setSelected(p.value); setShowInput(true); setKeyInput(""); } }}
                disabled={hasOwnKey}
                className={`group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
                  isActive
                    ? `bg-gradient-to-br ${p.color} shadow-sm`
                    : isChosen
                    ? "border-violet-500/40 bg-violet-500/[0.08] shadow-sm"
                    : "border-white/[0.08] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
                } ${hasOwnKey ? "cursor-default" : "cursor-pointer"}`}
              >
                {isActive && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                )}
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-white/60">
                  {p.value === "anthropic" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 19h20L12 2z"/><path d="M12 9v6M12 18h.01"/>
                    </svg>
                  )}
                  {p.value === "openai" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
                    </svg>
                  )}
                  {p.value === "gemini" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  )}
                  {p.value === "openrouter" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white/85">{p.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/40">{p.description}</p>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors"
                  >
                    Get API key ↗
                  </a>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Key input — shown when a provider is selected and no key is set */}
      <AnimatePresence>
        {!hasOwnKey && showInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
              <p className="mb-3 text-sm font-medium text-white/80">
                Add {PROVIDERS.find(p => p.value === selected)?.label} API key
              </p>
              <p className="mb-4 text-xs leading-relaxed text-white/40">
                Your key is encrypted at rest and never returned in API responses. It is only used server-side to proxy your AI queries.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void saveKey(); }}
                  placeholder={PROVIDERS.find(p => p.value === selected)?.placeholder}
                  className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 font-mono text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                />
                <button
                  type="button"
                  onClick={() => void saveKey()}
                  disabled={busy || keyInput.trim().length < 10}
                  className="shrink-0 rounded-xl border border-violet-500/30 bg-violet-600/25 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:bg-violet-600/40 disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Save key"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowInput(false); setKeyInput(""); }}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works note */}
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/25 mb-2">How BYOK works</p>
        <ul className="space-y-1.5 text-xs text-white/35 leading-relaxed">
          <li>• Your key is encrypted (AES-256) and stored in our database — never logged or returned.</li>
          <li>• When you ask a question, your key is decrypted server-side and used to call the provider API directly.</li>
          <li>• With your own key, AI usage is not counted against the Klokrs monthly quota.</li>
          <li>• You can remove your key at any time to revert to the metered free quota.</li>
        </ul>
      </div>

    </div>
  );
}
