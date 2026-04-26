"use client";

import { motion } from "framer-motion";

export interface ReportsDomainRow {
  domain: string;
  total_seconds: number;
  visit_count: number;
  percentage_of_total: number;
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function ReportsDomainTable({
  data,
  onDomainClick,
}: {
  data: ReportsDomainRow[];
  onDomainClick?: (domain: string, totalSeconds: number) => void;
}) {
  if (data.length === 0) return null;

  const maxSeconds = data[0]?.total_seconds ?? 1;
  const isClickable = !!onDomainClick;

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
        {data.map((row, i) => {
          const barWidth = (row.total_seconds / maxSeconds) * 100;
          return (
            <motion.li
              key={row.domain}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.04, duration: 0.35 }}
              onClick={() => onDomainClick?.(row.domain, row.total_seconds)}
              className={`group flex items-center gap-4 px-6 py-4 transition-colors duration-200 sm:px-8 ${
                isClickable
                  ? "cursor-pointer hover:bg-violet-500/[0.05]"
                  : "cursor-default"
              }`}
            >
              {/* Rank + favicon */}
              <div className="flex shrink-0 items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[11px] font-bold tabular-nums text-white/35">
                  {i + 1}
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
                  {row.domain.replace("www.", "")}
                </p>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, barWidth)}%` }}
                    transition={{ delay: 0.35 + i * 0.04, duration: 0.55, ease: "easeOut" }}
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
        })}
      </ul>
    </motion.div>
  );
}
