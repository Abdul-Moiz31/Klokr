"use client";

import { useId, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { TabSession } from "@/lib/supabase";

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function hourLabel(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
}) => {
  if (!active || !payload?.length) return null;
  const h = label ?? 0;
  const next = (h + 1) % 24;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f0f16]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
        {hourLabel(h)}–{hourLabel(next)}
      </p>
      <p className="text-base font-bold text-white">{formatTime(payload[0].value)}</p>
    </div>
  );
};

// "When were you active today" — buckets each session's time into the hour it
// started, drawn as a smooth area across the 24h day. Pure-analytics view that
// complements the per-domain breakdown.
export function TodayActivityChart({ sessions }: { sessions: TabSession[] }) {
  const gradId = useId().replace(/:/g, "");
  const [mounted, setMounted] = useState(false);
  const [nowHour, setNowHour] = useState(() => new Date().getHours());
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNowHour(new Date().getHours()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { chartData, peakHour, totalSeconds } = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, seconds: 0 }));
    for (const s of sessions) {
      const h = new Date(s.start_time).getHours();
      if (h >= 0 && h < 24) buckets[h]!.seconds += s.duration_seconds;
    }
    let peak = 0;
    for (let h = 1; h < 24; h++) {
      if (buckets[h]!.seconds > buckets[peak]!.seconds) peak = h;
    }
    const total = buckets.reduce((sum, b) => sum + b.seconds, 0);
    return { chartData: buckets, peakHour: total > 0 ? peak : null, totalSeconds: total };
  }, [sessions]);

  if (sessions.length === 0) return null;

  const maxSeconds = Math.max(...chartData.map((d) => d.seconds), 1);
  const useMinutes = maxSeconds < 3600;
  const yFormatter = (v: number) =>
    v === 0 ? "" : useMinutes ? `${Math.round(v / 60)}m` : `${(v / 3600).toFixed(1)}h`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/25 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/[0.07] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-white/95">Active hours today</h3>
            <InfoTooltip text="Tracked time bucketed by the hour each session began. Shows when in the day you were most active." side="bottom" />
          </div>
          <p className="mt-0.5 text-sm text-white/40">
            {peakHour !== null
              ? `Most active around ${hourLabel(peakHour)}–${hourLabel((peakHour + 1) % 24)}`
              : "Your day, hour by hour"}
          </p>
        </div>
        {totalSeconds > 0 && (
          <div className="flex items-center gap-3">
            <div className="hidden h-5 w-px bg-white/10 sm:block" />
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">Tracked today</p>
              <p className="text-lg font-bold text-white">{formatTime(totalSeconds)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 pb-6 pt-4 sm:px-4 sm:pb-8 sm:pt-6">
        <div className="h-56 w-full sm:h-64">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                  tickFormatter={hourLabel}
                  height={24}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickFormatter={yFormatter}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(124,58,237,0.35)", strokeWidth: 1 }} />
                {nowHour >= 0 && nowHour < 24 && (
                  <ReferenceLine x={nowHour} stroke="rgba(6,182,212,0.45)" strokeDasharray="4 3" />
                )}
                <Area
                  type="monotone"
                  dataKey="seconds"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  isAnimationActive
                  animationDuration={700}
                  animationEasing="ease-out"
                />
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </motion.div>
  );
}
