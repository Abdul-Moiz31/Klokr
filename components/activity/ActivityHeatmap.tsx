"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

export interface DayStat {
  date: string; // YYYY-MM-DD
  totalSeconds: number;
}

interface Props {
  stats: DayStat[];
  productiveThresholdSeconds: number;
  todayStr: string;
  streak: number;
  productiveDays: number;
  bestDayStr: string | null;
  onDayClick: (date: string, totalSeconds: number) => void;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NUM_WEEKS = 13;

function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function buildGrid(todayStr: string): string[][] {
  const today = new Date(todayStr + "T00:00:00");
  const dow = today.getDay(); // 0=Sun
  const daysToMonday = dow === 0 ? 6 : dow - 1;

  const start = new Date(today);
  start.setDate(today.getDate() - daysToMonday - (NUM_WEEKS - 1) * 7);

  const weeks: string[][] = [];
  const cursor = new Date(start);

  for (let w = 0; w < NUM_WEEKS; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(localDateStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function getMonthLabels(weeks: string[][]): Array<{ col: number; label: string }> {
  const labels: Array<{ col: number; label: string }> = [];
  let prev = "";
  for (let w = 0; w < weeks.length; w++) {
    const ym = weeks[w]![0]!.slice(0, 7);
    if (ym !== prev) {
      const d = new Date(weeks[w]![0]! + "T00:00:00");
      labels.push({ col: w, label: d.toLocaleDateString("en-US", { month: "short" }) });
      prev = ym;
    }
  }
  return labels;
}

type Level = "empty" | "minimal" | "light" | "medium" | "heavy" | "productive";

function getLevel(seconds: number, threshold: number): Level {
  if (seconds === 0) return "empty";
  const r = seconds / threshold;
  if (r >= 1) return "productive";
  if (r >= 0.75) return "heavy";
  if (r >= 0.5) return "medium";
  if (r >= 0.25) return "light";
  return "minimal";
}

const CELL_BG: Record<Level, string> = {
  empty: "bg-white/[0.04] border border-white/[0.07]",
  minimal: "bg-violet-950/70 border border-violet-900/30",
  light: "bg-violet-800/60 border border-violet-700/30",
  medium: "bg-violet-600/60 border border-violet-500/30",
  heavy: "bg-violet-500/75 border border-violet-400/30",
  productive: "bg-gradient-to-br from-violet-500 to-cyan-400 border border-violet-400/40 shadow-[0_0_6px_rgba(124,58,237,0.35)]",
};

const LEGEND: Array<{ level: Level; label: string }> = [
  { level: "empty", label: "None" },
  { level: "minimal", label: "<25%" },
  { level: "light", label: "25–50%" },
  { level: "medium", label: "50–75%" },
  { level: "heavy", label: "75–99%" },
  { level: "productive", label: "Goal" },
];

function formatTime(s: number): string {
  if (s === 0) return "No data";
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatFull(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function ActivityHeatmap({ stats, productiveThresholdSeconds, todayStr, streak, productiveDays, bestDayStr, onDayClick }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const statMap = new Map(stats.map((s) => [s.date, s.totalSeconds]));
  const weeks = buildGrid(todayStr);
  const monthLabels = getMonthLabels(weeks);

  const hoveredStat = hovered ? (statMap.get(hovered) ?? 0) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/25 backdrop-blur-md"
    >
      {/* Header */}
      <div className="border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-white/95">Browsing activity</h3>
              <InfoTooltip text="Each square is one day. Color shows how close you came to your productive-hours goal — set your threshold in Settings → Preferences. Click any square to see that day's domain breakdown." side="bottom" />
            </div>
            <p className="mt-0.5 text-xs text-white/40">Last {NUM_WEEKS} weeks — each square is one day</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span className="text-xs font-semibold text-white/80 tabular-nums">{streak}d</span>
              <span className="text-[10px] text-white/35">streak</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-violet-500 to-cyan-400" />
              <span className="text-xs font-semibold text-white/80 tabular-nums">{productiveDays}</span>
              <span className="text-[10px] text-white/35">productive days</span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-5 sm:px-6">
        {/* Month labels */}
        <div className="mb-1.5 flex" style={{ paddingLeft: "2.25rem" }}>
          {weeks.map((_, wi) => {
            const monthLabel = monthLabels.find((m) => m.col === wi);
            return (
              <div key={wi} className="w-[1.125rem] shrink-0 text-[10px] text-white/30 font-medium">
                {monthLabel?.label ?? ""}
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex gap-0">
          {/* Day labels */}
          <div className="mr-1 flex flex-col gap-0.5">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className="flex h-[1.125rem] w-8 items-center">
                {i % 2 === 0 && (
                  <span className="text-[9px] font-medium text-white/25 uppercase tracking-wide">{d}</span>
                )}
              </div>
            ))}
          </div>

          {/* Week columns */}
          <div className="flex gap-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((dateStr, di) => {
                  const seconds = statMap.get(dateStr) ?? 0;
                  const level = getLevel(seconds, productiveThresholdSeconds);
                  const isToday = dateStr === todayStr;
                  const isFuture = dateStr > todayStr;
                  const isHovered = hovered === dateStr;
                  const isBestDay = dateStr === bestDayStr;

                  return (
                    <button
                      key={di}
                      type="button"
                      disabled={isFuture || (seconds === 0 && dateStr !== todayStr)}
                      onClick={() => !isFuture && seconds > 0 && onDayClick(dateStr, seconds)}
                      onMouseEnter={() => !isFuture && setHovered(dateStr)}
                      onMouseLeave={() => setHovered(null)}
                      className={`relative h-[1.125rem] w-[1.125rem] rounded-sm transition-all duration-100 ${
                        isFuture ? "opacity-20 cursor-default" : seconds > 0 ? "cursor-pointer" : "cursor-default"
                      } ${CELL_BG[isFuture ? "empty" : level]} ${
                        isHovered ? "scale-125 z-10" : ""
                      } ${isToday ? "ring-1 ring-white/40 ring-offset-[1px] ring-offset-transparent" : ""} ${
                        isBestDay ? "ring-1 ring-yellow-400/60 ring-offset-[1px] ring-offset-transparent" : ""
                      }`}
                      aria-label={`${dateStr}: ${formatTime(seconds)}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Hover tooltip bar */}
        <div className="mt-4 h-7 flex items-center">
          {hovered ? (
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span className="font-medium text-white/90">{formatFull(hovered)}</span>
              <span className="text-white/30">·</span>
              <span className={hoveredStat > 0 ? "text-violet-300 font-medium" : "text-white/35"}>
                {formatTime(hoveredStat)}
              </span>
              {hoveredStat >= productiveThresholdSeconds && (
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Productive
                </span>
              )}
              {hovered === bestDayStr && hoveredStat > 0 && (
                <span className="rounded-full border border-yellow-500/25 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                  ★ Best day
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-white/20">Hover a square to preview · click to open report</p>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Legend</span>
          <div className="flex items-center gap-2">
            {LEGEND.map(({ level, label }) => (
              <div key={level} className="flex items-center gap-1">
                <div className={`h-3 w-3 rounded-sm ${CELL_BG[level]}`} />
                <span className="text-[10px] text-white/35">{label}</span>
              </div>
            ))}
          </div>
          <span className="ml-auto text-[10px] text-white/25">
            Goal: {Math.round(productiveThresholdSeconds / 3600)}h/day
          </span>
        </div>
      </div>
    </motion.div>
  );
}
