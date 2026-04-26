"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";

const BENEFITS: { title: string; blurb: string }[] = [
  {
    title: "Ground truth in the browser",
    blurb: "Time is tied to real domains and tabs—not guesses or self-reported task lists.",
  },
  {
    title: "No timers to babysit",
    blurb: "The extension runs quietly while you work. You don’t start and stop a clock.",
  },
  {
    title: "Top sites, instantly",
    blurb: "See where minutes actually went: ranked domains, visit counts, and daily totals.",
  },
  {
    title: "Idle that reflects reality",
    blurb: "Long gaps pause attribution so your totals match focused work, not AFK time.",
  },
  {
    title: "Web + extension in sync",
    blurb: "Sign in once; sessions flow to your dashboard with Supabase-backed sync.",
  },
  {
    title: "Focus tied to your plan",
    blurb: "Optional daily planner and domain tags help match tab time to what you intended.",
  },
];

export function BenefitsClock() {
  const gradId = `needle-${useId().replace(/:/g, "")}`;
  const [active, setActive] = useState(0);
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { amount: 0.3 });
  const needleDeg = -90 + (active * 360) / BENEFITS.length;

  useEffect(() => {
    if (!inView) return;
    const t = window.setInterval(() => {
      setActive((a) => (a + 1) % BENEFITS.length);
    }, 4500);
    return () => window.clearInterval(t);
  }, [inView]);

  return (
    <section id="benefits" className="relative py-24" ref={sectionRef}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/5 to-transparent" />
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <span className="text-violet-400 font-semibold text-sm tracking-widest uppercase mb-4 block">
            Benefits
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">
            Every turn of the clock,{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              a reason to use Tably
            </span>
          </h2>
          <p className="mt-4 text-white/50 text-lg max-w-2xl mx-auto">
            The hand moves through what matters—automatic tracking, clear insight,
            and a workflow that fits how you really work.
          </p>
        </motion.div>

        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
            className="relative mx-auto w-[min(100%,20rem)] aspect-square"
          >
            <div className="absolute inset-0 rounded-full border border-white/10 bg-gradient-to-br from-violet-600/10 to-cyan-600/5 shadow-2xl shadow-violet-900/20" />
            <svg
              className="relative h-full w-full"
              viewBox="0 0 200 200"
              aria-hidden
            >
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke="currentColor"
                className="text-white/10"
                strokeWidth="1"
              />
              {BENEFITS.map((_, i) => {
                const a = (-90 + (i * 360) / BENEFITS.length) * (Math.PI / 180);
                const r = 78;
                const x = 100 + r * Math.cos(a);
                const y = 100 + r * Math.sin(a);
                const on = i === active;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={on ? 5 : 3}
                    className={on ? "text-cyan-400" : "text-white/25"}
                    fill="currentColor"
                  />
                );
              })}
              <g
                style={{
                  transform: `rotate(${needleDeg}deg)`,
                  transformOrigin: "100px 100px",
                  transition: "transform 0.85s cubic-bezier(0.34, 1.3, 0.64, 1)",
                }}
              >
                <line
                  x1="100"
                  y1="100"
                  x2="100"
                  y2="34"
                  stroke={`url(#${gradId})`}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="100" cy="100" r="6" className="fill-violet-500" />
                <circle
                  cx="100"
                  cy="100"
                  r="3"
                  className="fill-white"
                />
                <defs>
                  <linearGradient
                    id={gradId}
                    x1="100"
                    y1="100"
                    x2="100"
                    y2="34"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#a78bfa" />
                    <stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </g>
            </svg>
            <div
              className="pointer-events-auto absolute bottom-0 left-1/2 flex -translate-x-1/2 translate-y-1/2 gap-1.5"
              role="tablist"
              aria-label="Select benefit"
            >
              {BENEFITS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => setActive(i)}
                  className={`h-1.5 w-1.5 rounded-full transition-all ${
                    i === active
                      ? "w-4 bg-cyan-400"
                      : "bg-white/25 hover:bg-white/45"
                  }`}
                />
              ))}
            </div>
          </motion.div>

          <div className="min-h-[12rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md"
              >
                <p className="text-cyan-400/90 text-sm font-mono tabular-nums mb-2">
                  {String(active + 1).padStart(2, "0")} / {String(BENEFITS.length).padStart(2, "0")}
                </p>
                <h3 className="text-2xl font-bold text-white mb-3">
                  {BENEFITS[active].title}
                </h3>
                <p className="text-white/55 leading-relaxed text-base">
                  {BENEFITS[active].blurb}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
