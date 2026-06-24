"use client";

import { motion, useInView, type Variants } from "framer-motion";
import { useRef } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.65, ease } },
};

const cardVariant: Variants = {
  hidden: { opacity: 0, y: 44, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease } },
};

function TabsVisual({ active }: { active: boolean }) {
  const tabs = ["github.com", "youtube.com", "twitter.com", "notion.so", "reddit.com", "news.ycombinator.com"];

  return (
    <div className="relative min-h-[188px] overflow-hidden bg-gradient-to-b from-violet-600/12 via-violet-600/5 to-transparent px-5 pt-5">
      <div className="pointer-events-none absolute -top-8 left-0 h-24 w-2/3 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="flex gap-1.5 mb-4 overflow-hidden">
        {tabs.slice(0, 4).map((t, i) => (
          <motion.div
            key={t}
            initial={{ opacity: 0, y: 8 }}
            animate={active ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15 + i * 0.06, duration: 0.4, ease }}
            className={`shrink-0 max-w-[88px] truncate rounded-t-md border border-b-0 border-white/10 px-2.5 py-1 text-[9px] ${
              i === 2 ? "bg-violet-500/30 text-violet-100" : "bg-white/[0.06] text-white/45"
            }`}
          >
            {t}
          </motion.div>
        ))}
      </div>
      <div className="space-y-2.5">
        {tabs.map((t, i) => (
          <motion.div
            key={t}
            initial={{ opacity: 0, x: -8 }}
            animate={active ? { opacity: 0.75, x: 0 } : {}}
            transition={{ delay: 0.35 + i * 0.05, duration: 0.45, ease }}
            className="flex items-center gap-2"
          >
            <div className="h-2 w-2 shrink-0 rounded-full bg-violet-400/50" />
            <div className="h-1.5 flex-1 rounded-full bg-white/12" style={{ maxWidth: `${92 - i * 11}%` }} />
          </motion.div>
        ))}
      </div>
      <div className="absolute bottom-3 right-4 text-[10px] font-medium text-white/35">32 tabs open</div>
    </div>
  );
}

function ClockVisual({ active }: { active: boolean }) {
  return (
    <div className="relative flex min-h-[188px] items-center justify-center overflow-hidden bg-gradient-to-b from-cyan-600/12 via-cyan-600/5 to-transparent">
      <div className="pointer-events-none absolute -top-6 right-0 h-24 w-2/3 rounded-full bg-cyan-500/15 blur-3xl" />
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={active ? { scale: 1, opacity: 1 } : {}}
        transition={{ duration: 0.55, ease }}
        className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/15 bg-white/[0.03] shadow-[0_0_40px_rgba(34,211,238,0.12)]"
      >
        <motion.div
          animate={active ? { rotate: 360 } : {}}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/2 h-6 w-0.5 origin-bottom rounded-full bg-violet-400"
          style={{ rotate: 30 }}
        />
        <motion.div
          animate={active ? { rotate: 360 } : {}}
          transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/2 h-4 w-0.5 origin-bottom rounded-full bg-cyan-400"
          style={{ rotate: -60 }}
        />
        <div className="h-2 w-2 rounded-full bg-white/90" />
      </motion.div>
      <div className="absolute right-5 top-4 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-300">
        estimated?
      </div>
      <div className="absolute bottom-4 left-5 text-[10px] text-white/40">~2h logged · ~6h unknown</div>
    </div>
  );
}

function ReportVisual({ active }: { active: boolean }) {
  const bars = [72, 45, 28, 18];

  return (
    <div className="relative min-h-[188px] overflow-hidden bg-gradient-to-b from-rose-600/10 via-rose-600/4 to-transparent p-5">
      <div className="pointer-events-none absolute -top-8 right-0 h-24 w-2/3 rounded-full bg-rose-500/15 blur-3xl" />
      <div className="rounded-xl border border-white/10 bg-[#0A0A12]/90 p-3.5 shadow-inner">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] text-white/45">Weekly report</span>
          <span className="text-[9px] text-white/30">PDF</span>
        </div>
        <div className="space-y-2.5">
          {bars.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-1.5 w-12 rounded bg-white/[0.06]" />
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={active ? { width: `${w}%`, opacity: 1 } : {}}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.55, ease }}
                className="h-2 rounded bg-gradient-to-r from-white/10 to-white/20"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-3 right-4 flex items-center gap-1 text-[10px] text-red-400/80">
        <span className="h-1 w-1 rounded-full bg-red-400/80" />
        No tab data
      </div>
    </div>
  );
}

const problems = [
  {
    Visual: TabsVisual,
    title: "Tabs blur together",
    body: "You open 30 tabs before 10am. By the end of the day you have no idea which ones actually moved the needle and which were just background noise.",
    gradient: "from-violet-600/10 to-purple-600/5",
    glow: "group-hover:shadow-violet-500/10",
  },
  {
    Visual: ClockVisual,
    title: "No honest data",
    body: "Manual time tracking is a lie you tell yourself. You round up, forget blocks, and skip the embarrassing stuff. The truth lives in your browser tabs.",
    gradient: "from-cyan-600/10 to-blue-600/5",
    glow: "group-hover:shadow-cyan-500/10",
  },
  {
    Visual: ReportVisual,
    title: "Reports that mean nothing",
    body: "Existing tools show you data about meetings and tasks, but not your actual digital behavior. That's where your real day lives.",
    gradient: "from-rose-600/8 to-violet-600/5",
    glow: "group-hover:shadow-rose-500/10",
  },
];

export function Problem() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="problem" className="relative scroll-mt-28 py-24">
      <div ref={ref} className="relative mx-auto max-w-7xl px-6">
        <motion.div
          variants={container}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          className="mx-auto mb-14 max-w-3xl text-center md:mb-16"
        >
          <motion.span
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-400"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            The Problem
          </motion.span>

          <motion.h2 variants={fadeUp} className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight lg:text-5xl">
            You end every day not knowing{" "}
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              where 8 hours went.
            </span>
          </motion.h2>

          <motion.p variants={fadeUp} className="text-lg leading-relaxed text-white/50">
            The problem isn&apos;t discipline. It&apos;s that you&apos;ve never had accurate data about your own digital behavior.
          </motion.p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          className="grid gap-4 md:grid-cols-3"
        >
          {problems.map(({ Visual, title, body, gradient, glow }) => (
            <motion.div
              key={title}
              variants={cardVariant}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.3, ease }}
              className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${gradient} backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:shadow-xl ${glow}`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <Visual active={inView} />
              <div className="border-t border-white/5 bg-[#0A0A0F]/50 p-6 pt-5 md:p-7 md:pt-6">
                <h3 className="mb-2.5 text-lg font-bold text-white md:text-xl">{title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{body}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
