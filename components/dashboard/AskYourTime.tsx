"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const HISTORY_KEY = "klokrs_ai_history";
const MAX_HISTORY  = 20;

const SUGGESTIONS = [
  "How much time did I spend on YouTube this week?",
  "What's my most-visited site this month?",
  "Which days was I most active?",
];

interface HistoryEntry {
  id: string;
  question: string;
  answer: string;
  provider: string;
  ts: number;
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY))); } catch { /* ignore */ }
}

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function providerLabel(p: string): string {
  if (p === "openai")     return "GPT";
  if (p === "gemini")     return "Gemini";
  if (p === "openrouter") return "OpenRouter";
  return "Claude";
}

export function AskYourTime() {
  const [question, setQuestion]     = useState("");
  const [answer, setAnswer]         = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [history, setHistory]       = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setError("Please sign in again."); setLoading(false); return; }

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ question: trimmed }),
      });
      const json = await res.json() as { answer?: string; error?: string; provider?: string };
      if (!res.ok) { setError(json.error ?? "Something went wrong."); setLoading(false); return; }

      const text     = json.answer ?? "";
      const provider = json.provider ?? "anthropic";
      setAnswer(text);

      const entry: HistoryEntry = { id: crypto.randomUUID(), question: trimmed, answer: text, provider, ts: Date.now() };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_HISTORY);
        saveHistory(next);
        return next;
      });
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setLoading(false);
  };

  const reuseQuestion = (q: string) => {
    setQuestion(q);
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="mb-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.06] to-cyan-500/[0.04] px-5 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10c0-1.5-.3-2.9-.9-4.2" /><path d="M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7v.5" /><line x1="12" y1="17" x2="12" y2="17.01" />
          </svg>
        </span>
        <h3 className="text-sm font-semibold text-white/85">Ask your time</h3>
        <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">AI</span>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="ml-auto flex items-center gap-1 text-[11px] text-white/35 transition hover:text-white/65"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/>
            </svg>
            History ({history.length})
          </button>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={(e) => { e.preventDefault(); void ask(question); }} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Ask anything about your tracked time…"
          className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white/90 placeholder-white/25 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="shrink-0 rounded-xl border border-violet-500/30 bg-violet-600/25 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:bg-violet-600/40 disabled:opacity-40"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {/* Suggestion chips */}
      {!answer && !error && !loading && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setQuestion(s); void ask(s); }}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/45 transition hover:border-white/20 hover:text-white/75"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Answer / error */}
      <AnimatePresence mode="wait">
        {(answer || error) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className={`mt-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
              error
                ? "border-red-500/20 bg-red-500/[0.07] text-red-300/90"
                : "border-white/10 bg-white/[0.03] text-white/75"
            }`}
          >
            {error ?? answer}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History panel */}
      <AnimatePresence>
        {historyOpen && history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-2.5 border-t border-white/[0.06] pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/25">Recent questions</p>
              {history.map((entry) => (
                <div key={entry.id} className="group rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => reuseQuestion(entry.question)}
                      className="min-w-0 flex-1 truncate text-left text-xs font-medium text-white/70 transition hover:text-white/95"
                      title={entry.question}
                    >
                      {entry.question}
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/30">
                        {providerLabel(entry.provider)}
                      </span>
                      <span className="text-[10px] text-white/25 tabular-nums">{timeAgo(entry.ts)}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-white/45">{entry.answer}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <Link
          href="/ai"
          className="text-xs text-white/30 transition hover:text-violet-300"
        >
          Open full AI page →
        </Link>
        <Link
          href="/dashboard/settings?tab=ai"
          className="flex items-center gap-1 text-xs text-white/25 transition hover:text-white/55"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Configure AI key
        </Link>
      </div>
    </div>
  );
}
