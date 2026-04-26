"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const chips = [
  "Chrome extension",
  "Real-time by domain",
  "Idle-aware",
];

export function PostHero() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <section
      className="relative border-y border-white/5 bg-white/[0.02] py-10"
      ref={ref}
    >
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center gap-5 md:flex-row md:justify-between md:text-left"
        >
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/90">
              Why Klokr
            </p>
            <p className="text-lg text-white/80 md:text-xl font-medium leading-snug">
              Automatic tab time, a dashboard that makes sense, and a planner
              that ties focus back to the sites you actually use.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 md:justify-end">
            {chips.map((label, i) => (
              <motion.span
                key={label}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm text-white/60"
              >
                {label}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
