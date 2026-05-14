"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { getSiteName, groupByRootDomain } from "@/lib/domain";

interface DomainRow {
  domain: string;
  totalSeconds: number;
  visits: number;
}

const MINOR_THRESHOLD_S = 5 * 60;

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const RANK_STYLES = [
  { badge: "bg-violet-500/20 text-violet-300 border-violet-500/30", bar: "from-violet-500 to-violet-400", row: "bg-violet-500/[0.04] hover:bg-violet-500/[0.08]" },
  { badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25", bar: "from-cyan-500 to-cyan-400", row: "bg-cyan-500/[0.03] hover:bg-cyan-500/[0.06]" },
  { badge: "bg-white/10 text-white/60 border-white/15", bar: "from-white/40 to-white/25", row: "bg-white/[0.02] hover:bg-white/[0.05]" },
];

const DEFAULT_STYLE = {
  badge: "bg-white/5 text-white/35 border-white/10",
  bar: "from-violet-600/60 to-cyan-600/50",
  row: "hover:bg-white/[0.04]",
};

type GroupedRow = {
  rootDomain: string;
  totalSeconds: number;
  visits: number;
  subdomains: DomainRow[];
};

export function DomainTable({
  data,
  onDomainClick,
}: {
  data: DomainRow[];
  onDomainClick?: (domain: string, totalSeconds: number) => void;
}) {
  const [minorExpanded, setMinorExpanded] = useState(false);

  if (data.length === 0) return null;

  const grouped: GroupedRow[] = groupByRootDomain(data);

  const totalDay = grouped.reduce((s, d) => s + d.totalSeconds, 0) || 1;
  const maxSeconds = grouped[0]?.totalSeconds || 1;

  const major = grouped.filter((d) => d.totalSeconds >= MINOR_THRESHOLD_S);
  const minor = grouped.filter((d) => d.totalSeconds < MINOR_THRESHOLD_S);
  const minorSeconds = minor.reduce((s, d) => s + d.totalSeconds, 0);

  const renderGroup = (group: GroupedRow, i: number, rankIndex: number) => {
    const style = RANK_STYLES[rankIndex] ?? DEFAULT_STYLE;
    const share = (group.totalSeconds / totalDay) * 100;
    const barWidth = (group.totalSeconds / maxSeconds) * 100;
    const siteName = getSiteName(group.rootDomain);

    return (
      <motion.li
        key={group.rootDomain}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.22 + i * 0.04, duration: 0.35 }}
        onClick={() => onDomainClick?.(group.rootDomain, group.totalSeconds)}
        className={`group relative flex items-center gap-4 px-6 py-4 transition-colors duration-200 sm:gap-5 sm:px-8 ${style.row} ${onDomainClick ? "cursor-pointer" : "cursor-default"}`}
      >
        {/* Rank badge + favicon */}
        <div className="flex shrink-0 items-center gap-3">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold tabular-nums ${style.badge}`}>
            {rankIndex + 1}
          </span>
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${group.rootDomain}&sz=32`}
              alt=""
              width={18}
              height={18}
              className="rounded-sm"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.25"; }}
            />
          </div>
        </div>

        {/* Site name + bar */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="block truncate text-sm font-semibold text-white/90" title={group.rootDomain}>
              {siteName}
            </span>
            <span className="shrink-0 text-xs text-white/35 tabular-nums">
              {share < 1 ? "<1" : Math.round(share)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, barWidth)}%` }}
              transition={{ delay: 0.3 + i * 0.04, duration: 0.55, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${style.bar}`}
            />
          </div>
        </div>

        {/* Time + visits */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-bold tabular-nums text-white">{formatTime(group.totalSeconds)}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/40 tabular-nums">
            {group.visits} {group.visits === 1 ? "visit" : "visits"}
          </span>
        </div>
      </motion.li>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/25 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-white/[0.07] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-white/95">All domains today</h3>
            <InfoTooltip text="Grouped by root domain. Ranked by time spent." side="bottom" />
          </div>
          <p className="mt-0.5 text-sm text-white/40">Ranked by time spent</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium text-white/30">
          <span className="inline-block h-2 w-2 rounded-full bg-violet-400/70" />
          <span>{grouped.length} domain{grouped.length !== 1 ? "s" : ""} tracked</span>
        </div>
      </div>

      {/* Main rows */}
      <ul className="divide-y divide-white/[0.05]">
        {major.map((group, i) => renderGroup(group, i, i))}

        {/* "Other" grouped row */}
        {minor.length > 0 && (
          <>
            <li>
              <button
                type="button"
                onClick={() => setMinorExpanded((v) => !v)}
                className="group flex w-full items-center gap-4 px-6 py-3.5 text-left transition-colors hover:bg-white/[0.03] sm:gap-5 sm:px-8"
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
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-white/20"
                      style={{ width: `${Math.max(2, (minorSeconds / maxSeconds) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-bold tabular-nums text-white/60">{formatTime(minorSeconds)}</span>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-white/25 transition-transform duration-200 ${minorExpanded ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
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
                    {minor.map((group, i) => renderGroup(group, major.length + i, major.length + i))}
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
