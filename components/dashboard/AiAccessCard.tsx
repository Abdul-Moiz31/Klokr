"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";

type Provider = "anthropic" | "openai" | "gemini" | "openrouter";

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

const PROVIDERS: { value: Provider; label: string; placeholder: string; hint: string; url: string }[] = [
  { value: "anthropic",  label: "Anthropic",   placeholder: "sk-ant-...",  hint: "Get a key at console.anthropic.com",    url: "https://console.anthropic.com" },
  { value: "openai",     label: "OpenAI",      placeholder: "sk-...",      hint: "Get a key at platform.openai.com",      url: "https://platform.openai.com/api-keys" },
  { value: "gemini",     label: "Gemini",      placeholder: "AIzaSy...",   hint: "Get a key at aistudio.google.com",      url: "https://aistudio.google.com/apikey" },
  { value: "openrouter", label: "OpenRouter",  placeholder: "sk-or-v1-...", hint: "Get a key at openrouter.ai/settings", url: "https://openrouter.ai/settings/keys" },
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

export function AiAccessCard({ onChange }: { onChange?: () => void }) {
  const [status, setStatus]       = useState<KeyStatus | null>(null);
  const [open, setOpen]           = useState(false);
  const [provider, setProvider]   = useState<Provider>("anthropic");
  const [keyInput, setKeyInput]   = useState("");
  const [busy, setBusy]           = useState(false);
  const [msg, setMsg]             = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await authedFetch("/api/ai-key");
      if (res.ok) {
        const data = await res.json() as KeyStatus;
        setStatus(data);
        setProvider(data.provider ?? "anthropic");
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
          setProvider(data.provider ?? "anthropic");
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveKey = async () => {
    if (keyInput.trim().length < 10) { setMsg("Enter a valid API key."); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await authedFetch("/api/ai-key", {
        method: "POST",
        body: JSON.stringify({ provider, key: keyInput.trim() }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setMsg(json.error ?? "Could not save key."); setBusy(false); return; }
      setKeyInput(""); setOpen(false);
      await refresh();
      onChange?.();
    } catch { setMsg("Could not save key."); }
    setBusy(false);
  };

  const removeKey = async () => {
    setBusy(true); setMsg(null);
    try {
      await authedFetch("/api/ai-key", { method: "DELETE" });
      await refresh();
      onChange?.();
    } catch { setMsg("Could not remove key."); }
    setBusy(false);
  };

  if (!status) return null;

  const { quota, hasOwnKey } = status;
  const pct = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
  const activeProvider = PROVIDERS.find((p) => p.value === (hasOwnKey ? status.provider : provider)) ?? PROVIDERS[0]!;

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {hasOwnKey ? (
            <p className="text-xs text-white/50">
              <span className="font-medium text-emerald-300">{activeProvider.label} key active</span> — unlimited AI, billed to you.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] text-white/45">
                <span>AI questions this month ({quota.plan})</span>
                <span className="tabular-nums">{quota.used}/{quota.limit}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full ${quota.remaining === 0 ? "bg-amber-400/70" : "bg-violet-400/70"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setMsg(null); }}
          className="shrink-0 text-xs text-white/35 transition hover:text-white/65"
        >
          {hasOwnKey ? "Manage key" : "Use your own key"}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {hasOwnKey ? (
                <>
                  <p className="mb-2 text-xs text-white/45">
                    <span className="font-medium text-white/65">{activeProvider.label}</span> key is active. Remove it to switch providers or revert to the metered quota.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/40">
                      •••••••••••••••• (key set)
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeKey()}
                      disabled={busy}
                      className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-2 text-xs leading-relaxed text-white/45">
                    Add your own AI key for unlimited use, billed directly to you. Your key is encrypted and never shown again.{" "}
                    <a href={activeProvider.url} target="_blank" rel="noopener noreferrer" className="text-violet-300 hover:underline">
                      {activeProvider.hint} ↗
                    </a>
                  </p>

                  {/* Provider selector */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {PROVIDERS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => { setProvider(p.value); setKeyInput(""); setMsg(null); }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          provider === p.value
                            ? "bg-violet-600/80 text-white border border-violet-500/40"
                            : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder={activeProvider.placeholder}
                      className="flex-1 min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white placeholder-white/25 outline-none focus:border-violet-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => void saveKey()}
                      disabled={busy}
                      className="rounded-lg border border-violet-500/30 bg-violet-600/25 px-3 py-2 text-xs font-medium text-violet-100 transition hover:bg-violet-600/40 disabled:opacity-40"
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </div>
                </>
              )}
              {msg && <p className="mt-2 text-xs text-red-400">{msg}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
