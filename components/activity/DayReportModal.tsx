"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface DomainRow {
  domain: string;
  totalSeconds: number;
  visits: number;
}

interface Props {
  date: string | null; // YYYY-MM-DD
  userId: string;
  productiveThresholdSeconds: number;
  onClose: () => void;
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function HorizontalBar({ domain, seconds, maxSeconds, visits }: {
  domain: string;
  seconds: number;
  maxSeconds: number;
  visits: number;
}) {
  const pct = Math.max(3, (seconds / maxSeconds) * 100);
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex w-5 h-5 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.06]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
          alt=""
          width={12}
          height={12}
          className="rounded-sm"
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-medium text-white/80 truncate">{domain.replace("www.", "")}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-white/40 tabular-nums">{formatTime(seconds)}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-white/35 tabular-nums">
              {visits}v
            </span>
          </div>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500/80"
          />
        </div>
      </div>
    </div>
  );
}

export function DayReportModal({ date, userId, productiveThresholdSeconds, onClose }: Props) {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    setDomains([]);

    const supabase = createClient();
    void supabase
      .from("tab_sessions")
      .select("domain, duration_seconds, visits")
      .eq("user_id", userId)
      .eq("date", date)
      .order("duration_seconds", { ascending: false })
      .then(({ data }: { data: Array<{ domain: string; duration_seconds: number; visits: number }> | null }) => {
        if (!data) { setLoading(false); return; }

        // Aggregate by domain
        const map = new Map<string, { totalSeconds: number; visits: number }>();
        for (const s of data) {
          const cur = map.get(s.domain) ?? { totalSeconds: 0, visits: 0 };
          map.set(s.domain, {
            totalSeconds: cur.totalSeconds + s.duration_seconds,
            visits: cur.visits + (s.visits ?? 1),
          });
        }
        const rows: DomainRow[] = Array.from(map.entries())
          .map(([domain, v]) => ({ domain, ...v }))
          .sort((a, b) => b.totalSeconds - a.totalSeconds);

        setDomains(rows);
        setLoading(false);
      });
  }, [date, userId]);

  const totalSeconds = domains.reduce((s, d) => s + d.totalSeconds, 0);
  const topDomain = domains[0]?.domain ?? "—";
  const maxSeconds = domains[0]?.totalSeconds ?? 1;
  const isProductive = totalSeconds >= productiveThresholdSeconds;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {date && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            aria-modal
            role="dialog"
          >
            <div
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-[#0f0f17] shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/80">
                    Daily report
                  </p>
                  <h2 className="mt-0.5 text-base font-semibold text-white/95">
                    {date ? formatDate(date) : ""}
                  </h2>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  {!loading && isProductive && (
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
                      Productive
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:bg-white/5 hover:text-white/80 transition-colors"
                    aria-label="Close"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 2l8 8M10 2l-8 8" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.07]">
                {[
                  { label: "Total time", value: loading ? "—" : formatTime(totalSeconds), tooltip: "Sum of all tracked browsing time for this day." },
                  { label: "Domains", value: loading ? "—" : String(domains.length), tooltip: "Number of unique domains visited." },
                  { label: "Top site", value: loading ? "—" : topDomain.replace("www.", ""), tooltip: "The domain with the most tracked time that day." },
                ].map(({ label, value, tooltip }) => (
                  <div key={label} className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{label}</p>
                      <InfoTooltip text={tooltip} side="bottom" />
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-white/90 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                {loading ? (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 rounded-lg bg-white/5" />
                    ))}
                  </div>
                ) : domains.length === 0 ? (
                  <p className="py-6 text-center text-sm text-white/30">No sessions recorded for this day.</p>
                ) : (
                  <>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                      Time breakdown
                    </p>
                    <div className="divide-y divide-white/[0.04]">
                      {domains.slice(0, 10).map((d) => (
                        <HorizontalBar
                          key={d.domain}
                          domain={d.domain}
                          seconds={d.totalSeconds}
                          maxSeconds={maxSeconds}
                          visits={d.visits}
                        />
                      ))}
                    </div>
                    {domains.length > 10 && (
                      <p className="mt-2 text-center text-xs text-white/25">
                        +{domains.length - 10} more domains
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
                <p className="text-[10px] text-white/25">
                  Download report available in a future release
                </p>
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/25 cursor-not-allowed"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5.5 1v7M3 6l2.5 2L8 6M1 9.5h9" />
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
