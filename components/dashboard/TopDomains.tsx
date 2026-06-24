"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { getSiteName, groupByRootDomain } from "@/lib/domain";

interface DomainRow {
  domain: string;
  totalSeconds: number;
  visits: number;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const RANK_BARS = [
  "from-violet-500 to-violet-400",
  "from-cyan-500 to-cyan-400",
  "from-violet-500/80 to-cyan-500/70",
  "from-violet-600/70 to-cyan-600/60",
  "from-violet-600/60 to-cyan-600/50",
];

const TOP_N = 5;

// Compact "top sites today" card for the dashboard. The full, exhaustive
// per-domain ranking lives on the Activity page — this is the at-a-glance view.
export function TopDomains({
  data,
  onDomainClick,
}: {
  data: DomainRow[];
  onDomainClick?: (domain: string, totalSeconds: number) => void;
}) {
  if (data.length === 0) return null;

  const grouped = groupByRootDomain(data);
  const totalDay = grouped.reduce((s, d) => s + d.totalSeconds, 0) || 1;
  const maxSeconds = grouped[0]?.totalSeconds || 1;
  const top = grouped.slice(0, TOP_N);
  const remaining = grouped.length - top.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/25 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-white/95">Top sites today</h3>
            <InfoTooltip text="Your five most-used sites today, grouped by root domain. See every tracked domain on the Activity page." side="bottom" />
          </div>
          <p className="mt-0.5 text-sm text-white/40">Where your time went</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/40 tabular-nums">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400/70" />
          {grouped.length}
        </span>
      </div>

      {/* Rows */}
      <ul className="flex-1 divide-y divide-white/[0.05]">
        {top.map((group, i) => {
          const share = (group.totalSeconds / totalDay) * 100;
          const barWidth = (group.totalSeconds / maxSeconds) * 100;
          const siteName = getSiteName(group.rootDomain);
          return (
            <motion.li
              key={group.rootDomain}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.05, duration: 0.35 }}
              onClick={() => onDomainClick?.(group.rootDomain, group.totalSeconds)}
              className={`group flex items-center gap-3 px-4 py-3 transition-colors duration-200 ${onDomainClick ? "cursor-pointer hover:bg-white/[0.04]" : "cursor-default"}`}
            >
              <span className="w-3 shrink-0 text-center text-xs font-bold tabular-nums text-white/30">
                {i + 1}
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
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="block truncate text-sm font-semibold text-white/90" title={group.rootDomain}>
                    {siteName}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-white">{formatTime(group.totalSeconds)}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(2, barWidth)}%` }}
                      transition={{ delay: 0.32 + i * 0.05, duration: 0.55, ease: "easeOut" }}
                      className={`h-full rounded-full bg-gradient-to-r ${RANK_BARS[i] ?? RANK_BARS[4]}`}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] text-white/35 tabular-nums">
                    {share < 1 ? "<1" : Math.round(share)}%
                  </span>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>

      {/* Footer link to the full list on Activity */}
      <Link
        href="/activity"
        className="flex items-center justify-center gap-1.5 border-t border-white/[0.07] px-4 py-3 text-xs font-medium text-white/45 transition-colors hover:bg-white/[0.03] hover:text-white/80"
      >
        {remaining > 0 ? `See all ${grouped.length} domains in Activity` : "Open Activity"}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </motion.div>
  );
}
