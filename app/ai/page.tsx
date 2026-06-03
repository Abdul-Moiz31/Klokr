"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { AppShell } from "@/components/dashboard/AppShell";
import { Loader } from "@/components/ui/Loader";
import { useAuthSession } from "@/lib/useAuthSession";
import { createClient } from "@/lib/supabase";

/* ─── Types ───────────────────────────────────── */

interface HistoryEntry {
  id: string;
  question: string;
  answer: string;
  provider: string;
  ts: number;
}

const HISTORY_KEY = "klokrs_ai_history";
const MAX_HISTORY = 20;

const SUGGESTIONS = [
  "How much time did I spend on YouTube this week?",
  "Which days was I most productive?",
  "What's my most-visited site this month?",
  "How much time on social media vs deep work?",
  "Which hour of the day am I most active?",
  "Compare this week to last week.",
];

/* ─── Helpers ─────────────────────────────────── */

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY))); } catch { /* */ }
}

function timeAgo(ts: number): string {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function providerLabel(p: string): string {
  const map: Record<string, string> = { openai: "GPT", gemini: "Gemini", openrouter: "OpenRouter", anthropic: "Claude" };
  return map[p] ?? "AI";
}

function providerColor(p: string): string {
  const map: Record<string, string> = {
    openai: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    gemini: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    openrouter: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    anthropic: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  };
  return map[p] ?? "bg-white/10 text-white/50 border-white/15";
}

/* ─── Page ────────────────────────────────────── */

export default function AiInsightsPage() {
  const { session, status: authStatus } = useAuthSession();
  const user = session?.user ?? null;

  const [question, setQuestion]   = useState("");
  const [answer, setAnswer]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [provider, setProvider]   = useState("anthropic");
  const inputRef  = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const ask = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const supabase = createClient();
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (!sess?.access_token) { setError("Please sign in again."); setLoading(false); return; }

      const res  = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.access_token}` },
        body: JSON.stringify({ question: trimmed }),
      });
      const json = await res.json() as { answer?: string; error?: string; provider?: string };

      if (!res.ok) { setError(json.error ?? "Something went wrong."); setLoading(false); return; }

      const text = json.answer ?? "";
      const prov = json.provider ?? "anthropic";
      setAnswer(text);
      setProvider(prov);

      const entry: HistoryEntry = { id: crypto.randomUUID(), question: trimmed, answer: text, provider: prov, ts: Date.now() };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_HISTORY);
        saveHistory(next);
        return next;
      });

      setTimeout(() => answerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setLoading(false);
  }, [loading]);

  const reuse = (q: string) => {
    setQuestion(q);
    setAnswer(null);
    setError(null);
    inputRef.current?.focus();
  };

  if (authStatus === "loading" || !user) {
    return <AppShell title="AI Insights"><Loader /></AppShell>;
  }

  return (
    <AppShell title="AI Insights">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/80">AI</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white/95 sm:text-3xl">Ask your time</h1>
          <p className="mt-1 text-sm text-white/45">
            Ask anything about your tracked browsing — answered from your own data, never shared.
          </p>
        </div>
        <Link
          href="/dashboard/settings?tab=ai"
          className="mt-3 inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/50 transition hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300 sm:mt-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Configure AI keys
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">

        {/* ── Left: Chat area ─────────────────── */}
        <div className="xl:col-span-2">
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent">

            {/* Input */}
            <div className="p-5 sm:p-6">
              <form
                onSubmit={(e) => { e.preventDefault(); void ask(question); }}
                className="flex gap-3"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={500}
                  placeholder="Ask anything about your tracked time…"
                  className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/90 placeholder-white/25 outline-none transition-colors focus:border-violet-500/50 focus:bg-white/[0.08] focus:ring-1 focus:ring-violet-500/30"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="shrink-0 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-40"
                >
                  {loading ? (
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                </button>
              </form>

              {/* Suggestion chips — only before first answer */}
              {!answer && !error && !loading && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setQuestion(s); void ask(s); }}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/45 transition hover:border-violet-500/30 hover:bg-violet-500/[0.08] hover:text-white/75"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Answer / error */}
            <AnimatePresence mode="wait">
              {(answer || error || loading) && (
                <motion.div
                  key={answer ?? error ?? "loading"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  ref={answerRef}
                  className="border-t border-white/[0.06] px-5 py-5 sm:px-6"
                >
                  {loading ? (
                    <div className="flex items-center gap-3 text-sm text-white/40">
                      <span className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                      Thinking…
                    </div>
                  ) : error ? (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                      </span>
                      <p className="text-sm leading-relaxed text-red-300/90">{error}</p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${providerColor(provider)}`}>
                        {providerLabel(provider)[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${providerColor(provider)}`}>
                            {providerLabel(provider)}
                          </span>
                          <span className="text-[10px] text-white/25">just now</span>
                        </div>
                        <p className="text-sm leading-relaxed text-white/80">{answer}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ask another / clear */}
            {(answer || error) && !loading && (
              <div className="border-t border-white/[0.05] px-5 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => { setAnswer(null); setError(null); setQuestion(""); inputRef.current?.focus(); }}
                  className="text-xs text-white/30 transition hover:text-white/60"
                >
                  ← Ask another question
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: History sidebar ───────────── */}
        <div className="xl:col-span-1">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/>
                </svg>
                <span className="text-xs font-semibold text-white/50">History</span>
              </div>
              {history.length > 0 && (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/30">
                  {history.length}
                </span>
              )}
            </div>

            {history.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-xs text-white/25">Your questions will appear here.</p>
              </div>
            ) : (
              <ul className="max-h-[520px] divide-y divide-white/[0.05] overflow-y-auto">
                {history.map((entry) => (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                    className="group px-5 py-4"
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => reuse(entry.question)}
                        className="min-w-0 flex-1 text-left text-xs font-medium text-white/70 transition hover:text-violet-300"
                        title="Click to reuse this question"
                      >
                        {entry.question}
                      </button>
                    </div>
                    <p className="mb-2 line-clamp-2 text-[11px] leading-relaxed text-white/35">
                      {entry.answer}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${providerColor(entry.provider)}`}>
                        {providerLabel(entry.provider)}
                      </span>
                      <span className="text-[10px] text-white/20">{timeAgo(entry.ts)}</span>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>

          {/* Privacy note */}
          <p className="mt-4 px-1 text-[11px] leading-relaxed text-white/25">
            Questions are answered using only your tracked domain data. No page content, URLs, or personal information is ever read or shared.
          </p>
        </div>

      </div>
    </AppShell>
  );
}
