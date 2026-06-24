"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

const SUGGESTIONS = [
  "How much time did I spend on YouTube this week?",
  "What's my most-visited site this month?",
  "Which days was I most active?",
];

export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    <div ref={rootRef} className="relative w-full max-w-md">
      <div
        data-tour="header-search"
        className={`flex items-center gap-2 rounded-lg border bg-white/[0.04] px-3 py-1.5 transition-colors ${
          open ? "border-violet-500/40" : "border-white/10"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/30">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={question}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void ask(question); }}
          maxLength={500}
          placeholder="Ask about your time…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-white/85 placeholder-white/30 outline-none"
        />
        {loading && (
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-violet-400" aria-hidden />
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#12121a] shadow-xl shadow-black/50">
          {!answer && !error && !loading && (
            <div className="p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">Try asking</p>
              <div className="flex flex-col gap-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setQuestion(s); void ask(s); }}
                    className="rounded-lg px-2 py-1.5 text-left text-xs text-white/55 transition hover:bg-white/[0.05] hover:text-white/85"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(answer || error) && (
            <div className={`px-4 py-3 text-sm leading-relaxed ${error ? "text-red-300/90" : "text-white/75"}`}>
              {error ?? answer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
