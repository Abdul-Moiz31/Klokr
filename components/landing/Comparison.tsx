"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

const headerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease } },
};

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
  cells: [Cell, Cell, Cell, Cell];
}

const ROWS: Row[] = [
  { feature: "Price to get started", cells: [txt("Free"), txt("$6.50/mo"), txt("$9.99/mo"), txt("Free / $9")] },
  { feature: "Automatic tracking — no timers to start", cells: [y, y, y, p("manual timers")] },
  { feature: "Runs in your browser, full web dashboard", cells: [y, y, p("desktop only"), y] },
  { feature: "Ask AI about your time in plain English", cells: [y, n, p("reports only"), n] },
  { feature: "Bring your own AI key — unlimited & private", cells: [y, n, n, n] },
  { feature: "Daily planner that maps tasks to real time", cells: [y, n, p("projects"), p("projects")] },
  { feature: "Schedule-aware site blocking, no toggle needed", cells: [y, p("manual FocusTime"), p("focus sessions"), n] },
  { feature: "Built-in Pomodoro focus timer", cells: [y, p("focus blocks"), y, n] },
  { feature: "Streaks, XP & accountability score", cells: [y, n, n, n] },
  { feature: "Domain drill-down + 90-day heatmap", cells: [y, y, y, p("reports")] },
  { feature: "PDF & CSV export", cells: [y, y, y, y] },
];

function CellContent({ cell, isKlokrs }: { cell: Cell; isKlokrs: boolean }) {
  if (cell.t === "text") {
    return (
      <span className={`text-sm tabular-nums ${isKlokrs ? "font-semibold text-violet-200" : "font-medium text-white/55"}`}>
        {cell.value}
      </span>
    );
  }

  if (cell.t === "yes") {
    return (
      <span
        className={`inline-flex h-5 w-5 items-center justify-center text-sm leading-none ${
          isKlokrs ? "text-violet-300" : "text-white/40"
        }`}
        aria-label="Included"
      >
        ✓
      </span>
    );
  }

  if (cell.t === "no") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center text-sm text-white/18" aria-label="Not included">
        —
      </span>
    );
  }

  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className="text-sm text-white/25">—</span>
      <span className="max-w-[72px] text-center text-[10px] leading-tight text-white/30">{cell.note}</span>
    </span>
  );
}

export function Comparison() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="comparison" className="relative scroll-mt-28 py-24">
      <div ref={ref} className="mx-auto max-w-6xl px-6">
        <motion.div
          variants={headerContainer}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          className="mb-14 text-center"
        >
          <motion.span
            variants={fadeUp}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-400"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            Comparison
          </motion.span>

          <motion.h2 variants={fadeUp} className="text-4xl font-bold leading-tight lg:text-5xl">
            Everything they do —{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              in one tab, for free
            </span>
          </motion.h2>

          <motion.p variants={fadeUp} className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/50">
            Most trackers make you choose between automatic tracking, focus tools, planning, and AI. Klokrs gives you all of it in the browser — no desktop app, no per-seat pricing.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease, delay: 0.12 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0B0B10]/80"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              {/* Header */}
              <div className="grid grid-cols-[minmax(200px,1.35fr)_repeat(4,minmax(88px,1fr))] border-b border-white/[0.06]">
                <div className="px-6 py-5 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-white/25">
                  Feature
                </div>
                {PRODUCTS.map((name, i) => {
                  const isKlokrs = i === 0;
                  return (
                    <div
                      key={name}
                      className={`relative px-3 py-5 text-center sm:px-4 ${
                        isKlokrs ? "bg-violet-500/[0.06]" : ""
                      }`}
                    >
                      {isKlokrs && (
                        <>
                          <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-violet-500/25" />
                          <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-violet-500/25" />
                          <div className="pointer-events-none absolute inset-x-3 top-0 h-16 rounded-b-full bg-violet-500/[0.08] blur-2xl" />
                        </>
                      )}
                      <span
                        className={`relative text-sm font-semibold ${
                          isKlokrs
                            ? "bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent"
                            : "text-white/45"
                        }`}
                      >
                        {name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Rows */}
              {ROWS.map((row, ri) => (
                <motion.div
                  key={row.feature}
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.2 + ri * 0.04, duration: 0.4, ease }}
                  className="grid grid-cols-[minmax(200px,1.35fr)_repeat(4,minmax(88px,1fr))] border-b border-white/[0.04] last:border-0"
                >
                  <div className="px-6 py-4 text-left text-sm leading-snug text-white/65">{row.feature}</div>
                  {row.cells.map((cell, ci) => {
                    const isKlokrs = ci === 0;
                    return (
                      <div
                        key={ci}
                        className={`flex items-center justify-center px-3 py-4 sm:px-4 ${
                          isKlokrs ? "relative bg-violet-500/[0.06]" : ""
                        }`}
                      >
                        {isKlokrs && (
                          <>
                            <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-violet-500/20" />
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-violet-500/20" />
                          </>
                        )}
                        <CellContent cell={cell} isKlokrs={isKlokrs} />
                      </div>
                    );
                  })}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="mt-5 text-center text-[11px] leading-relaxed text-white/25"
        >
          Competitor details based on their publicly listed plans as of 2026. Klokrs is free while in beta — early users keep their plan.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/35"
        >
          <a href="/vs/rescuetime" className="underline-offset-2 hover:text-violet-300 hover:underline">
            Full comparison: Klokrs vs RescueTime
          </a>
          <span aria-hidden>·</span>
          <a href="/vs/toggl" className="underline-offset-2 hover:text-violet-300 hover:underline">
            Full comparison: Klokrs vs Toggl
          </a>
        </motion.div>
      </div>
    </section>
  );
}
