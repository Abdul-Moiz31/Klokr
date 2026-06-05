"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

// ── Cell model ────────────────────────────────────────────────────────────────
// Every claim here is intentionally conservative: Klokrs rows reflect only
// shipped features, and competitor cells are based on their publicly listed
// plans/capabilities as of 2026. Where a competitor partly does something we
// say "partial" with a short qualifier rather than a hard ✗.

type Cell =
  | { t: "yes" }
  | { t: "no" }
  | { t: "partial"; note: string }
  | { t: "text"; value: string };

const y: Cell = { t: "yes" };
const n: Cell = { t: "no" };
const p = (note: string): Cell => ({ t: "partial", note });
const txt = (value: string): Cell => ({ t: "text", value });

const PRODUCTS = ["Klokrs", "RescueTime", "Rize", "Toggl Track"] as const;

interface Row {
  feature: string;
  // [Klokrs, RescueTime, Rize, Toggl Track]
  cells: [Cell, Cell, Cell, Cell];
}

const ROWS: Row[] = [
  {
    feature: "Price to get started",
    cells: [txt("Free"), txt("$6.50/mo"), txt("$9.99/mo"), txt("Free / $9")],
  },
  {
    feature: "Automatic tracking — no timers to start",
    cells: [y, y, y, p("manual timers")],
  },
  {
    feature: "Runs in your browser, full web dashboard",
    cells: [y, y, p("desktop only"), y],
  },
  {
    feature: "Ask AI about your time in plain English",
    cells: [y, n, p("reports only"), n],
  },
  {
    feature: "Bring your own AI key — unlimited & private",
    cells: [y, n, n, n],
  },
  {
    feature: "Daily planner that maps tasks to real time",
    cells: [y, n, p("projects"), p("projects")],
  },
  {
    feature: "Built-in Pomodoro focus timer",
    cells: [y, p("focus blocks"), y, n],
  },
  {
    feature: "Streaks, XP & accountability score",
    cells: [y, n, n, n],
  },
  {
    feature: "Domain drill-down + 90-day heatmap",
    cells: [y, y, y, p("reports")],
  },
  {
    feature: "PDF & CSV export",
    cells: [y, y, y, y],
  },
];

// ── Cell renderers ────────────────────────────────────────────────────────────

function YesIcon({ highlight }: { highlight: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
        highlight
          ? "border-violet-400/40 bg-violet-500/20 text-violet-300"
          : "border-emerald-400/25 bg-emerald-500/10 text-emerald-400"
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function NoIcon() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/25">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </span>
  );
}

function CellView({ cell, highlight }: { cell: Cell; highlight: boolean }) {
  if (cell.t === "yes") return <YesIcon highlight={highlight} />;
  if (cell.t === "no") return <NoIcon />;
  if (cell.t === "text")
    return (
      <span className={`text-sm font-semibold tabular-nums ${highlight ? "text-violet-200" : "text-white/70"}`}>
        {cell.value}
      </span>
    );
  // partial
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-400">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      <span className="text-[10px] leading-tight text-white/35">{cell.note}</span>
    </span>
  );
}

export function Comparison() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="comparison" className="py-24">
      <div ref={ref} className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <span className="mb-4 block text-sm font-semibold uppercase tracking-widest text-violet-400">
            Comparison
          </span>
          <h2 className="text-4xl font-bold lg:text-5xl">
            Everything they do —{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              in one tab, for free
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/40">
            Most trackers make you choose between automatic tracking, focus
            tools, planning, and AI. Klokrs gives you all of it in the browser —
            no desktop app, no per-seat pricing.
          </p>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg shadow-black/30 backdrop-blur-md"
        >
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-5 py-5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30 sm:px-7">
                  Feature
                </th>
                {PRODUCTS.map((name, i) => {
                  const isKlokrs = i === 0;
                  return (
                    <th
                      key={name}
                      className={`px-3 py-5 text-center align-bottom sm:px-4 ${
                        isKlokrs ? "relative" : ""
                      }`}
                    >
                      {isKlokrs && (
                        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-violet-600 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-md">
                          You&apos;re here
                        </span>
                      )}
                      <span
                        className={`text-sm font-bold ${
                          isKlokrs
                            ? "bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent"
                            : "text-white/55"
                        }`}
                      >
                        {name}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, ri) => (
                <motion.tr
                  key={row.feature}
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.2 + ri * 0.04, duration: 0.4 }}
                  className="border-b border-white/[0.05] last:border-0"
                >
                  <td className="px-5 py-4 text-left text-sm text-white/70 sm:px-7">
                    {row.feature}
                  </td>
                  {row.cells.map((cell, ci) => {
                    const isKlokrs = ci === 0;
                    return (
                      <td
                        key={ci}
                        className={`px-3 py-4 text-center sm:px-4 ${
                          isKlokrs ? "bg-violet-500/[0.06]" : ""
                        }`}
                      >
                        <CellView cell={cell} highlight={isKlokrs} />
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Honesty note */}
        <p className="mt-5 text-center text-[11px] leading-relaxed text-white/25">
          Competitor details based on their publicly listed plans as of 2026.
          Klokrs is free while in beta — early users keep their plan.
        </p>
      </div>
    </section>
  );
}
