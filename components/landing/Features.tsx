"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, type Variants } from "framer-motion";
import { useAuthCta } from "@/lib/useAuthCta";
import { buttonClasses, ButtonArrowIcon } from "@/components/ui/Button";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

function SalesChartVisual() {
  const bars = [45, 72, 58, 90];
  const years = ["2017", "2018", "2019", "2020"];

  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A12] p-5">
      <div className="text-white/40 text-xs mb-1">Statistics</div>
      <div className="text-white font-semibold text-sm mb-5">Active hours today</div>
      <div className="flex items-end gap-3">
        {bars.map((h, i) => (
          <div key={years[i]} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full relative flex items-end h-28">
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-violet-600/20 via-violet-500/60 to-violet-400"
                style={{ height: `${h}%` }}
              />
              <div
                className="absolute w-2.5 h-2.5 rounded-full border-2 border-white bg-violet-500"
                style={{ bottom: `calc(${h}% - 5px)`, left: "50%", transform: "translateX(-50%)" }}
              />
            </div>
            <span className="text-white/30 text-[10px]">{years[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackingVisual() {
  const bars = [38, 62, 50, 80, 65, 92, 70];

  return (
    <div className="h-full min-h-[180px] rounded-xl border border-white/10 bg-[#0A0A12] p-5 flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <span className="text-white/40 text-xs">Focus Score</span>
        <span className="text-cyan-400 text-xs font-semibold">92%</span>
      </div>
      <div className="flex items-end gap-2 flex-1">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 relative flex items-end h-28">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-cyan-600/20 via-cyan-500/60 to-cyan-400"
              style={{ height: `${h}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardVisual() {
  const hours = ["9 AM", "10 AM", "11 AM", "12 PM", "1 PM"];
  const events = [
    { label: "Deep Work", tag: "github.com", top: 4, height: 50 },
    { label: "Design Review", tag: "figma.com", top: 64, height: 38 },
    { label: "Planning", tag: "notion.so", top: 112, height: 44 },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A12] p-4 min-h-[180px]">
      <div className="flex gap-3">
        <div className="flex h-40 flex-col justify-between text-[10px] text-white/25">
          {hours.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="relative h-40 flex-1 border-l border-white/5">
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-white/5"
              style={{ top: `${(i / (hours.length - 1)) * 100}%` }}
            />
          ))}
          {events.map((e) => (
            <div
              key={e.label}
              className="absolute left-2 right-2 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] px-2.5 py-1.5"
              style={{ top: e.top, height: e.height }}
            >
              <div className="text-[11px] font-medium leading-tight text-white">{e.label}</div>
              <div className="text-[10px] leading-tight text-white/40">{e.tag}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatsBento({ inView }: { inView: boolean }) {
  return (
    <div className="mt-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-center mb-12 max-w-2xl mx-auto"
      >
        <h2 className="text-3xl lg:text-4xl font-bold text-white">
          High-Impact Solutions for{" "}
          <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Time Accountability
          </span>
        </h2>
        <p className="text-white/50 text-lg mt-4">
          Equip yourself with the tools to track honestly, plan your day, and build lasting focus habits.
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
      >
        <motion.div
          variants={cardVariants}
          className="md:row-span-2 rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/10 to-purple-600/5 backdrop-blur-md p-8 flex flex-col justify-between min-h-[220px]"
        >
          <div>
            <h3 className="text-white font-bold text-lg mb-2">The Choice of Thousands</h3>
            <div className="flex -space-x-3 mt-4">
              {["AM", "SK", "JR", "ML"].map((initials) => (
                <div
                  key={initials}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 border-2 border-[#0A0A0F] flex items-center justify-center text-xs font-bold text-white"
                >
                  {initials}
                </div>
              ))}
            </div>
          </div>
          <p className="text-white/40 text-sm mt-6">Over 2,000 builders trust Klokrs to hold them accountable every day.</p>
        </motion.div>

        <motion.div
          variants={cardVariants}
          className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8"
        >
          <div className="text-5xl font-bold text-white">98%</div>
          <div className="text-white/60 font-medium mt-1">User Satisfaction</div>
          <p className="text-white/35 text-sm mt-4">Builders who track daily report feeling more in control of their time.</p>
        </motion.div>

        <motion.div
          variants={cardVariants}
          className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8"
        >
          <div className="text-5xl font-bold text-white">24/7</div>
          <div className="text-white/60 font-medium mt-1">Silent Tracking</div>
          <p className="text-white/35 text-sm mt-4">Runs quietly in the background — always available, never intrusive.</p>
        </motion.div>

        <motion.div
          variants={cardVariants}
          className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8"
        >
          <div className="text-5xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">20+</div>
          <div className="text-white/60 font-medium mt-1">Features Shipped</div>
          <p className="text-white/35 text-sm mt-4">From tab tracking to AI insights, planner, pomodoro, and exports.</p>
        </motion.div>

        <motion.div
          variants={cardVariants}
          className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 to-indigo-600/10 backdrop-blur-md p-8 flex items-center"
        >
          <p className="text-white font-semibold text-lg leading-snug">
            Smarter accountability —{" "}
            <span className="text-violet-300">plan your day, track your tabs, ask AI anything.</span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const ctaHref = useAuthCta();

  return (
    <section id="features" className="py-24">
      <div ref={ref} className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 max-w-2xl mx-auto"
        >
          <motion.span
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-sm font-medium mb-5"
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0, duration: 0.4 }}
          >
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
            Our Features
          </motion.span>
          <h2 className="text-4xl lg:text-5xl font-bold">
            <span className="text-white">Powerful Features to </span>
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Own Your Time
            </span>
          </h2>
          <p className="text-white/50 text-lg mt-5">
            Tracking, planning, and insight — built into one accountability tool that runs quietly in the background of your day.
          </p>
        </motion.div>

        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
        >
          {/* Hero feature card */}
          <motion.div
            variants={cardVariants}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/10 to-purple-600/5 backdrop-blur-md overflow-hidden"
          >
            <div className="p-8 pb-0 md:p-10 md:pb-0">
              <h3 className="text-2xl font-bold text-white mb-3">Automatic Tab Tracking</h3>
              <p className="text-white/50 text-sm leading-relaxed max-w-xl mb-6">
                Every domain you visit is tracked silently — cumulative time, visits, and idle detection included. Zero timers to start, zero habits to build.
              </p>
              <Link href={ctaHref} className={buttonClasses("primary", "sm", "mb-8")}>
                <ButtonArrowIcon size={22} />
                Get Started Free
              </Link>
            </div>
            <div className="px-4 pb-4 md:px-8 md:pb-8">
              <SalesChartVisual />
            </div>
          </motion.div>

          {/* Two-column feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div
              variants={cardVariants}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-600/10 to-blue-600/5 backdrop-blur-md overflow-hidden"
            >
              <div className="p-6 pb-4">
                <TrackingVisual />
              </div>
              <div className="p-6 pt-4 border-t border-white/5">
                <h3 className="text-xl font-bold text-white mb-2">Analytics Dashboard</h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  Hourly activity graph, top sites, domain bar chart, focus score, streak, and plan-vs-actual — all live, updating as you work.
                </p>
              </div>
            </motion.div>

            <motion.div
              variants={cardVariants}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/10 to-pink-600/5 backdrop-blur-md overflow-hidden"
            >
              <div className="p-6 pb-4">
                <DashboardVisual />
              </div>
              <div className="p-6 pt-4 border-t border-white/5">
                <h3 className="text-xl font-bold text-white mb-2">Daily Planner</h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  A Google Calendar-style vertical timeline for your day. Drag, resize, and assign domain tags to tasks so your actual browsing maps back to your plan.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Remaining features — compact grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            {[
              {
                title: "Ask AI",
                desc: "Ask natural-language questions about your data with your own API key.",
                icon: (
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                ),
              },
              {
                title: "Streaks & Activity",
                desc: "90-day heatmap, forgiving streak tracking, and productive-day counts.",
                icon: (
                  <path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.3-2-1-3 .5 2-.5 3-1.5 3C16.5 7 15 5 15 3c-2 1-3 3-3 5 0-2-1-4-3-6z" />
                ),
              },
              {
                title: "Pomodoro Timer",
                desc: "Built-in focus timer that runs alongside tracking in your daily report.",
                icon: (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" strokeLinecap="round" />
                  </>
                ),
              },
              {
                title: "PDF & CSV Export",
                desc: "Export any date range as a branded PDF report or raw CSV.",
                icon: (
                  <>
                    <path d="M12 3v12" strokeLinecap="round" />
                    <path d="M7 11l5 5 5-5" strokeLinecap="round" />
                    <path d="M5 19h14" strokeLinecap="round" />
                  </>
                ),
              },
            ].map((f) => (
              <motion.div
                key={f.title}
                variants={cardVariants}
                className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-6 hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl border border-violet-500/20 bg-violet-500/10 flex items-center justify-center mb-4">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                    {f.icon}
                  </svg>
                </div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <StatsBento inView={inView} />
      </div>
    </section>
  );
}
