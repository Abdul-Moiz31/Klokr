"use client";

import { useId, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DomainData {
  domain: string;
  pageTitle: string;
  totalSeconds: number;
}

function getSiteName(domain: string, pageTitle: string): string {
  const cleanDomain = domain.replace(/^www\./, "");
  if (pageTitle && pageTitle !== cleanDomain && pageTitle !== domain) {
    const parts = pageTitle.split(/\s[\|\-·—–]\s/);
    if (parts.length > 1) {
      const last = parts[parts.length - 1]!.trim();
      if (last.length > 0 && last.length <= 40) return last;
    }
    if (pageTitle.length <= 40) return pageTitle;
  }
  const name = cleanDomain.split(".")[0] ?? cleanDomain;
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f0f16]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
      <p className="mb-1 truncate text-[11px] font-medium uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="text-base font-bold text-white">{formatTime(payload[0].value)}</p>
    </div>
  );
};

export function DomainChart({
  data,
  totalSeconds = 0,
}: {
  data: DomainData[];
  totalSeconds?: number;
}) {
  const gradId = useId().replace(/:/g, "");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (data.length === 0) return null;

  const chartData = data.slice(0, 8).map((d) => ({
    domain: getSiteName(d.domain, d.pageTitle),
    seconds: d.totalSeconds,
  }));

  const maxSeconds = Math.max(...chartData.map((d) => d.seconds), 1);
  const useMinutes = maxSeconds < 3600;
  const yFormatter = (v: number) =>
    useMinutes ? `${Math.round(v / 60)}m` : `${(v / 3600).toFixed(1)}h`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/25 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/[0.07] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-white/95">Time by domain</h3>
            <InfoTooltip text={`Bar chart of your top ${chartData.length} domains today, ranked by total tracked time. Hover a bar for the exact duration.`} side="bottom" />
          </div>
          <p className="mt-0.5 text-sm text-white/40">Top {chartData.length} sites today</p>
        </div>

        {totalSeconds > 0 && (
          <div className="flex items-center gap-3">
            <div className="hidden h-5 w-px bg-white/10 sm:block" />
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">Total today</p>
              <p className="text-lg font-bold text-white">{formatTime(totalSeconds)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 pb-6 pt-4 sm:px-4 sm:pb-8 sm:pt-6">
        <div className="h-64 w-full sm:h-72">
          {mounted && <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 8 }}
              barCategoryGap="22%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="domain"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-22}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={yFormatter}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(124,58,237,0.08)", radius: 6 }}
              />
              <Bar
                dataKey="seconds"
                fill={`url(#${gradId})`}
                radius={[6, 6, 0, 0]}
                maxBarSize={44}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.75} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>}
        </div>
      </div>
    </motion.div>
  );
}
