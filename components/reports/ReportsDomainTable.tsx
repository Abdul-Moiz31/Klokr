"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSiteName, groupByRootDomain } from "@/lib/domain";

export interface ReportsDomainRow {
  domain: string;
  total_seconds: number;
  visit_count: number;
  percentage_of_total: number;
}

const MINOR_THRESHOLD_S = 5 * 60;

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function DomainRow({
  row,
  rank,
  animDelay,
  maxSeconds,
  isClickable,
  onDomainClick,
}: {
  row: ReportsDomainRow;
  rank: number;
  animDelay: number;
  maxSeconds: number;
  isClickable: boolean;
  onDomainClick?: (domain: string, totalSeconds: number) => void;
}) {
  const barWidth = (row.total_seconds / maxSeconds) * 100;
  return (
    <motion.li
      key={row.domain}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: animDelay, duration: 0.35 }}
      onClick={() => onDomainClick?.(row.domain, row.total_seconds)}
      className={`group flex items-center gap-4 px-6 py-4 transition-colors duration-200 sm:px-8 ${
        isClickable ? "cursor-pointer hover:bg-violet-500/[0.05]" : "cursor-default"
      }`}
    >
      {/* Rank + favicon */}
      <div className="flex shrink-0 items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[11px] font-bold tabular-nums text-white/35">
          {rank}
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://www.google.com/s2/favicons?domain=${row.domain}&sz=32`}
            alt=""
            width={18}
            height={18}
            className="rounded-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = "0.25";
            }}
          />
        </div>
      </div>

      {/* Domain + bar */}
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 truncate text-sm font-medium text-white/85" title={row.domain}>
          {getSiteName(row.domain)}
        </p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(2, barWidth)}%` }}
            transition={{ delay: animDelay + 0.1, duration: 0.55, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="flex w-20 shrink-0 justify-end">
        <span className="text-sm font-bold tabular-nums text-white">
          {formatTime(row.total_seconds)}
        </span>
      </div>
      <div className="hidden w-16 shrink-0 justify-end sm:flex">
        <span className="text-xs tabular-nums text-white/40">{row.visit_count}</span>
      </div>
      <div className="hidden w-16 shrink-0 justify-end sm:flex">
        <span className="text-xs tabular-nums text-white/40">{row.percentage_of_total}%</span>
      </div>

      {isClickable && (
        <div className="shrink-0 text-white/20 transition-colors group-hover:text-violet-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      )}
    </motion.li>
  );
}

export function ReportsDomainTable({
  data,
  onDomainClick,
}: {
  data: ReportsDomainRow[];
  onDomainClick?: (domain: string, totalSeconds: number) => void;
}) {
  const [minorExpanded, setMinorExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  if (data.length === 0) return null;

  const isClickable = !!onDomainClick;

  const toggleGroup = (root: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(root)) next.delete(root);
      else next.add(root);
      return next;
    });
  };

  // Adapt snake_case rows to the groupByRootDomain shape
  const adapted = data.map((r) => ({ domain: r.domain, totalSeconds: r.total_seconds, visits: r.visit_count, percentage_of_total: r.percentage_of_total }));
  const totalAllSeconds = adapted.reduce((s, r) => s + r.totalSeconds, 0) || 1;
  const grouped = groupByRootDomain(adapted).map((g) => ({
    ...g,
    percentage_of_total: Math.round((g.totalSeconds / totalAllSeconds) * 1000) / 10,
  }));

  const maxSeconds = grouped[0]?.totalSeconds ?? 1;

  const major = grouped.filter((d) => d.totalSeconds >= MINOR_THRESHOLD_S);
  const minor = grouped.filter((d) => d.totalSeconds < MINOR_THRESHOLD_S);
  const minorSeconds = minor.reduce((s, d) => s + d.totalSeconds, 0);
  const minorVisits = minor.reduce((s, d) => s + d.visits, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/25 backdrop-blur-md"
    >
      {/* Header */}
      <div className="border-b border-white/[0.07] px-6 py-5 sm:px-8">
        <h3 className="text-base font-semibold text-white/95">Time by domain</h3>
        <p className="mt-0.5 text-sm text-white/40">
          {data.length} domain{data.length !== 1 ? "s" : ""} · ranked by time spent
        </p>
      </div>

      {/* Column labels */}
      <div className="hidden grid-cols-[auto_1fr_80px_64px_64px_20px] items-center gap-4 border-b border-white/[0.05] px-6 py-2 sm:grid sm:px-8">
        <span className="w-14 text-[10px] font-semibold uppercase tracking-wider text-white/20" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/20">Domain</span>
        <span className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/20">Time</span>
        <span className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/20">Visits</span>
        <span className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/20">%</span>
        <span />
      </div>

      <ul className="divide-y divide-white/[0.05]">
        {/* Major rows */}
        {major.map((group, i) => {
          const asRow: ReportsDomainRow = { domain: group.rootDomain, total_seconds: group.totalSeconds, visit_count: group.visits, percentage_of_total: group.percentage_of_total };
          const hasSubdomains = group.subdomains.length > 1;
          const isExpanded = expandedGroups.has(group.rootDomain);
          return (
            <div key={group.rootDomain}>
              <div className="relative flex items-center">
                <div className="flex-1">
                  <DomainRow
                    row={asRow}
                    rank={i + 1}
                    animDelay={0.25 + i * 0.04}
                    maxSeconds={maxSeconds}
                    isClickable={isClickable}
                    onDomainClick={onDomainClick}
                  />
                </div>
                {hasSubdomains && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.rootDomain)}
                    className="absolute right-14 flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-white/35 hover:text-white/60 hover:bg-white/[0.08] transition-colors"
                  >
                    {group.subdomains.length}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              <AnimatePresence>
                {hasSubdomains && isExpanded && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden border-t border-white/[0.04] bg-white/[0.015] divide-y divide-white/[0.04]"
                  >
                    {group.subdomains
                      .sort((a, b) => b.totalSeconds - a.totalSeconds)
                      .map((sub) => (
                        <li key={sub.domain} className="flex items-center gap-3 px-8 py-2.5 sm:px-10">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/[0.08] bg-white/[0.04]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`https://www.google.com/s2/favicons?domain=${sub.domain}&sz=16`} alt="" width={12} height={12} className="rounded-sm opacity-70" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.15"; }} />
                          </div>
                          <span className="flex-1 truncate text-xs text-white/40">{sub.domain}</span>
                          <span className="shrink-0 text-xs tabular-nums text-white/50">{formatTime(sub.totalSeconds)}</span>
                          <span className="shrink-0 text-[10px] tabular-nums text-white/25">{sub.visits}v</span>
                        </li>
                      ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* "Other" grouped row */}
        {minor.length > 0 && (
          <>
            <li>
              <button
                type="button"
                onClick={() => setMinorExpanded((v) => !v)}
                className="group flex w-full items-center gap-4 px-6 py-3.5 text-left transition-colors hover:bg-white/[0.03] sm:px-8"
              >
                <div className="flex shrink-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[10px] font-bold text-white/30">
                    ···
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/25">
                      <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                    </svg>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-white/50">
                    Other — {minor.length} domain{minor.length !== 1 ? "s" : ""} under 5 min
                  </span>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-white/20" style={{ width: `${Math.max(2, (minorSeconds / maxSeconds) * 100)}%` }} />
                  </div>
                </div>
                <div className="flex w-20 shrink-0 justify-end">
                  <span className="text-sm font-bold tabular-nums text-white/60">{formatTime(minorSeconds)}</span>
                </div>
                <div className="hidden w-16 shrink-0 justify-end sm:flex">
                  <span className="text-xs tabular-nums text-white/30">{minorVisits}</span>
                </div>
                <div className="hidden w-16 shrink-0 justify-end sm:flex" />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-white/25 transition-transform duration-200 ${minorExpanded ? "rotate-180" : ""}`}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
            <AnimatePresence>
              {minorExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden border-t border-white/[0.04] bg-white/[0.02]"
                >
                  <ul className="divide-y divide-white/[0.04]">
                    {minor.map((group, i) => (
                      <DomainRow
                        key={group.rootDomain}
                        row={{ domain: group.rootDomain, total_seconds: group.totalSeconds, visit_count: group.visits, percentage_of_total: group.percentage_of_total }}
                        rank={major.length + i + 1}
                        animDelay={i * 0.03}
                        maxSeconds={maxSeconds}
                        isClickable={isClickable}
                        onDomainClick={onDomainClick}
                      />
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </ul>
    </motion.div>
  );
}
