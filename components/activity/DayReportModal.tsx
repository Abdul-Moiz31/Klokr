"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { getSiteName, groupByRootDomain } from "@/lib/domain";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface DomainRow {
  domain: string;
  totalSeconds: number;
  visits: number;
  subdomains?: DomainRow[];
}

interface Props {
  date: string | null; // YYYY-MM-DD
  userId: string;
  productiveThresholdSeconds: number;
  streak: number;
  productiveDays: number;
  totalDays: number;
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
          <span className="text-xs font-medium text-white/80 truncate">{getSiteName(domain)}</span>
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

const MINOR_THRESHOLD_S = 5 * 60;

export function DayReportModal({ date, userId, productiveThresholdSeconds, streak, productiveDays, totalDays, onClose }: Props) {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [minorExpanded, setMinorExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (domain: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });
  };

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
        const raw: DomainRow[] = Array.from(map.entries())
          .map(([domain, v]) => ({ domain, ...v }))
          .sort((a, b) => b.totalSeconds - a.totalSeconds);

        // Group subdomains under root domain
        const grouped = groupByRootDomain(raw).map((g) => ({
          domain: g.rootDomain,
          totalSeconds: g.totalSeconds,
          visits: g.visits,
          subdomains: g.subdomains.length > 1 ? g.subdomains.sort((a, b) => b.totalSeconds - a.totalSeconds) : [],
        }));

        setDomains(grouped);
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
                <div className="flex items-center gap-2 shrink-0 mt-0.5 flex-wrap justify-end">
                  {!loading && isProductive && (
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
                      Productive
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    <span className="text-[10px] font-semibold text-white/80 tabular-nums">{streak}d streak</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1">
                    <div className="h-2 w-2 rounded-sm bg-gradient-to-br from-violet-500 to-cyan-400" />
                    <span className="text-[10px] font-semibold text-white/80 tabular-nums">{productiveDays}/{totalDays} productive</span>
                  </div>
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
                  { label: "Top site", value: loading ? "—" : getSiteName(topDomain), tooltip: "The domain with the most tracked time that day." },
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
                ) : (() => {
                  const major = domains.filter((d) => d.totalSeconds >= MINOR_THRESHOLD_S);
                  const minor = domains.filter((d) => d.totalSeconds < MINOR_THRESHOLD_S);
                  const minorSeconds = minor.reduce((s, d) => s + d.totalSeconds, 0);
                  return (
                    <>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                        Time breakdown
                      </p>
                      <div className="divide-y divide-white/[0.04]">
                        {major.map((d) => (
                          <div key={d.domain}>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <HorizontalBar domain={d.domain} seconds={d.totalSeconds} maxSeconds={maxSeconds} visits={d.visits} />
                              </div>
                              {d.subdomains && d.subdomains.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(d.domain)}
                                  className="shrink-0 flex items-center gap-1 rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-white/35 hover:text-white/60 transition-colors"
                                >
                                  {d.subdomains.length + 1}
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-200 ${expandedGroups.has(d.domain) ? "rotate-180" : ""}`}>
                                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <AnimatePresence>
                              {d.subdomains && d.subdomains.length > 0 && expandedGroups.has(d.domain) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.18, ease: "easeInOut" }}
                                  className="overflow-hidden rounded-lg bg-white/[0.02] px-3 mb-1"
                                >
                                  {d.subdomains.map((sub) => (
                                    <HorizontalBar key={sub.domain} domain={sub.domain} seconds={sub.totalSeconds} maxSeconds={maxSeconds} visits={sub.visits} />
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>

                      {minor.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setMinorExpanded((v) => !v)}
                            className="mt-1 flex w-full items-center gap-3 rounded-lg py-2 text-left transition-colors hover:bg-white/[0.03]"
                          >
                            <div className="flex w-5 h-5 shrink-0 items-center justify-center rounded border border-white/[0.08] bg-white/[0.04]">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/25">
                                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                              </svg>
                            </div>
                            <span className="flex-1 text-xs font-medium text-white/40">
                              Other — {minor.length} domain{minor.length !== 1 ? "s" : ""} under 5 min
                            </span>
                            <span className="text-xs text-white/30 tabular-nums">{formatTime(minorSeconds)}</span>
                            <svg
                              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              className={`text-white/25 transition-transform duration-200 ${minorExpanded ? "rotate-180" : ""}`}
                            >
                              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>

                          <AnimatePresence>
                            {minorExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden rounded-lg bg-white/[0.02] px-3"
                              >
                                <div className="divide-y divide-white/[0.04]">
                                  {minor.map((d) => (
                                    <HorizontalBar
                                      key={d.domain}
                                      domain={d.domain}
                                      seconds={d.totalSeconds}
                                      maxSeconds={maxSeconds}
                                      visits={d.visits}
                                    />
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
