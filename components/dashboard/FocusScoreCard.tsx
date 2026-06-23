"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { computeFocusScore, type DomainSlice } from "@/lib/focus-score";
import { getSiteName } from "@/lib/domain";

type Props = {
  domains: DomainSlice[];
  goalHours: number;
};

function fmt(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 40) return "#7C3AED";
  return "#F59E0B";
}

export function FocusScoreCard({ domains, goalHours }: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fs = computeFocusScore(domains, goalHours);
  if (fs.totalSeconds === 0) return null; // nothing to score yet today

  const topName = domains[0] ? getSiteName(domains[0].domain) : "—";
  const color = scoreColor(fs.score);

  // Circular gauge geometry.
  const R = 34;
  const C = 2 * Math.PI * R;
  const dash = (fs.score / 100) * C;

  const summaryText =
    `My Klokrs Focus Score today: ${fs.score}/100 — "${fs.label}". ` +
    `${fmt(fs.totalSeconds)} tracked, top site ${topName}. Tracked automatically by Klokrs.`;

  const copySummary = () => {
    void navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          {/* Gauge */}
          <div className="relative h-[84px] w-[84px] shrink-0">
            <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
              <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
              <circle
                cx="42" cy="42" r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${dash} ${C}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold tabular-nums text-white">{fs.score}</span>
              <span className="text-[9px] uppercase tracking-wider text-white/35">score</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-white/85">Focus Score · {fs.label}</p>
            <p className="mt-0.5 text-xs text-white/45">
              {fmt(fs.totalSeconds)} tracked · {fs.goalPct}% of goal · {fs.concentrationPct}% on top 3 sites
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShareOpen((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/60 transition hover:border-white/20 hover:text-white/90"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {shareOpen ? "Close" : "Share"}
        </button>
      </div>

      <AnimatePresence>
        {shareOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {/* The screenshot-friendly "Wrapped" card */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-[#1a0b33] via-[#0f0a1e] to-[#04141a] p-6 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/70">My focus today</p>
              <p className="mt-3 text-6xl font-black tabular-nums" style={{ color }}>{fs.score}</p>
              <p className="mt-1 text-sm font-semibold text-white/80">{fs.label}</p>
              <div className="mx-auto mt-5 flex max-w-xs items-center justify-around gap-2 text-center">
                <div>
                  <p className="text-base font-bold text-white tabular-nums">{fmt(fs.totalSeconds)}</p>
                  <p className="text-[10px] text-white/40">tracked</p>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <p className="truncate text-base font-bold text-violet-200">{topName}</p>
                  <p className="text-[10px] text-white/40">top site</p>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <p className="text-base font-bold text-emerald-300 tabular-nums">{fs.goalPct}%</p>
                  <p className="text-[10px] text-white/40">of goal</p>
                </div>
              </div>
              <p className="mt-5 text-[11px] text-white/30">tracked automatically by Klokrs · klokrs.com</p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={copySummary}
                className="rounded-xl border border-violet-500/30 bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-600/35"
              >
                {copied ? "Copied!" : "Copy summary"}
              </button>
              <span className="text-xs text-white/35">or screenshot the card above to share</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
