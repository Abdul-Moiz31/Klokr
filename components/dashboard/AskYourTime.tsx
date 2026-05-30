"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";

const SUGGESTIONS = [
  "How much time did I spend on YouTube this week?",
  "What's my most-visited site this month?",
  "Which days was I most active?",
];

export function AskYourTime() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const json = await res.json() as { answer?: string; error?: string };
      if (!res.ok) { setError(json.error ?? "Something went wrong."); setLoading(false); return; }
      setAnswer(json.answer ?? "");
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setLoading(false);
  };

  return (
    <div className="mb-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.06] to-cyan-500/[0.04] px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10c0-1.5-.3-2.9-.9-4.2" /><path d="M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7v.5" /><line x1="12" y1="17" x2="12" y2="17.01" />
          </svg>
        </span>
        <h3 className="text-sm font-semibold text-white/85">Ask your time</h3>
        <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">AI</span>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void ask(question); }}
        className="flex gap-2"
      >
        <input
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
    </div>
  );
}
