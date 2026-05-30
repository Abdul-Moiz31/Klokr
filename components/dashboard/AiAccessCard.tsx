"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";

type Quota = {
  plan: "free" | "standard" | "pro";
  used: number;
  limit: number;
  remaining: number;
  hasOwnKey: boolean;
};

type KeyStatus = {
  hasOwnKey: boolean;
  provider: string;
  quota: Quota;
};

async function authedFetch(path: string, init?: RequestInit) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("not-authed");
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
  });
}

// Usage meter + BYOK key management for the AI features. Compact by default;
// expands to a key form. Shown under the Ask Your Time card.
export function AiAccessCard({ onChange }: { onChange?: () => void }) {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await authedFetch("/api/ai-key");
      if (res.ok) setStatus(await res.json() as KeyStatus);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authedFetch("/api/ai-key");
        if (!cancelled && res.ok) setStatus(await res.json() as KeyStatus);
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
        body: JSON.stringify({ provider: "anthropic", key: keyInput.trim() }),
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

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {hasOwnKey ? (
            <p className="text-xs text-white/50">
              <span className="font-medium text-emerald-300">Your own key is active</span> — unlimited AI, billed to you.
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
              <p className="mb-2 text-xs leading-relaxed text-white/45">
                Add your own Anthropic API key for unlimited AI use, billed directly to you.
                Your key is encrypted and never shown again. Get one at{" "}
                <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-violet-300 hover:underline">console.anthropic.com</a>.
              </p>
              {hasOwnKey ? (
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
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    disabled
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/60 [color-scheme:dark]"
                    value="anthropic"
                  >
                    <option value="anthropic">Anthropic</option>
                  </select>
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="sk-ant-..."
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
              )}
              {msg && <p className="mt-2 text-xs text-red-400">{msg}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
