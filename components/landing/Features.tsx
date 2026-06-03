"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(4px)" },
  show: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const cards = [
  {
    size: "large",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="16" r="14" /><path d="M16 8v8l5 3" />
      </svg>
    ),
    title: "Automatic Tab Tracking",
    description:
      "Every domain you visit is tracked silently — cumulative time, visits, and idle detection included. Zero timers to start, zero habits to build. Your real workday, captured without effort.",
    tags: ["Auto-track", "Idle Detection", "Multi-window"],
    gradient: "from-violet-600/20 to-purple-600/10",
    color: "text-violet-400",
  },
  {
    size: "medium",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20l5-7 4 4 4-5 5 8H4z" /><rect x="4" y="4" width="20" height="18" rx="2" />
      </svg>
    ),
    title: "Analytics Dashboard",
    description:
      "Hourly activity graph, top sites, domain bar chart, focus score, streak, and plan-vs-actual — all live, updating as you work.",
    tags: ["Hourly Chart", "Focus Score"],
    gradient: "from-cyan-600/20 to-blue-600/10",
    color: "text-cyan-400",
  },
  {
    size: "medium",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3H5a2 2 0 0 0-2 2v4" /><path d="M3 13v4" /><path d="M3 21v2" />
        <path d="M19 3h4a2 2 0 0 1 2 2v4" /><path d="M25 13v4" /><path d="M25 21v2" />
        <rect x="9" y="9" width="10" height="10" rx="1" />
        <path d="M9 3h10M3 9h6M19 9h6M9 19h10M3 19h6M19 19h6" />
      </svg>
    ),
    title: "Daily Planner",
    description:
      "A Google Calendar-style vertical timeline for your day. Drag, resize, and assign domain tags to tasks so your actual browsing time maps back to your plan.",
    tags: ["Timeline", "Task Attribution"],
    gradient: "from-violet-600/20 to-pink-600/10",
    color: "text-violet-400",
  },
  {
    size: "small",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10c0-1.5-.3-2.9-.9-4.2" />
        <path d="M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7v.5" />
        <line x1="12" y1="17" x2="12" y2="17.01" />
      </svg>
    ),
    title: "Ask AI",
    description:
      "Ask natural-language questions about your data — 'how much time on YouTube this week?' Use your own OpenAI, Gemini, Anthropic, or OpenRouter key for unlimited queries.",
    tags: [] as string[],
    gradient: "from-violet-600/15 to-indigo-600/10",
    color: "text-violet-400",
  },
  {
    size: "small",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: "Streaks & Activity",
    description:
      "90-day activity heatmap, forgiving streak tracking, productive-day counts, and your best-day record — all in one glance.",
    tags: [] as string[],
    gradient: "from-amber-600/10 to-orange-600/08",
    color: "text-amber-400",
  },
  {
    size: "small",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        <path d="M6 4l-1-1M18 4l1-1" />
      </svg>
    ),
    title: "Pomodoro Timer",
    description:
      "Built-in focus timer with work and break intervals. Runs alongside tracking so your focused blocks show up in your daily report.",
    tags: [] as string[],
    gradient: "from-red-600/10 to-rose-600/08",
    color: "text-red-400",
  },
  {
    size: "small",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    title: "PDF & CSV Export",
    description:
      "Export any date range as a branded PDF report or raw CSV. Daily aggregates, visit counts, and percentage breakdowns included.",
    tags: [] as string[],
    gradient: "from-cyan-600/15 to-teal-600/10",
    color: "text-cyan-400",
  },
] as const;

function FeatureText({ title, description, tags, titleSize }: {
  title: string; description: string; tags: readonly string[] | string[]; titleSize: string;
}) {
  return (
    <>
      <h3 className={`text-white font-bold ${titleSize} mb-3`}>{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed mb-5">{description}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" className="py-24">
      <div ref={ref} className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.span
            className="text-violet-400 font-semibold text-sm tracking-widest uppercase mb-4 block"
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0, duration: 0.4 }}
          >
            Features
          </motion.span>
          <h2 className="text-4xl lg:text-5xl font-bold">
            <motion.span className="inline-block" initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1, duration: 0.45 }}>
              Everything you need to{" "}
            </motion.span>
            <motion.span
              className="inline-block bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              own your time
            </motion.span>
          </h2>
        </motion.div>

        <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4" variants={containerVariants} initial="hidden" animate={inView ? "show" : "hidden"}>

          {/* Row 1: large (2/3) + medium (1/3) */}
          <motion.div
            variants={cardVariants}
            className={`md:col-span-2 backdrop-blur-md bg-gradient-to-br ${cards[0].gradient} bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300 group`}
          >
            <div className={`mb-5 ${cards[0].color} group-hover:scale-110 transition-transform duration-300`}>{cards[0].icon}</div>
            <FeatureText title={cards[0].title} description={cards[0].description} tags={cards[0].tags} titleSize="text-2xl" />
          </motion.div>

          <motion.div
            variants={cardVariants}
            className={`backdrop-blur-md bg-gradient-to-br ${cards[1].gradient} bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300 group`}
          >
            <div className={`mb-5 ${cards[1].color} group-hover:scale-110 transition-transform duration-300`}>{cards[1].icon}</div>
            <FeatureText title={cards[1].title} description={cards[1].description} tags={cards[1].tags} titleSize="text-xl" />
          </motion.div>

          {/* Row 2: medium (1/3) + small (1/3) + small (1/3) */}
          <motion.div
            variants={cardVariants}
            className={`backdrop-blur-md bg-gradient-to-br ${cards[2].gradient} bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300 group`}
          >
            <div className={`mb-5 ${cards[2].color} group-hover:scale-110 transition-transform duration-300`}>{cards[2].icon}</div>
            <FeatureText title={cards[2].title} description={cards[2].description} tags={cards[2].tags} titleSize="text-xl" />
          </motion.div>

          <motion.div
            variants={cardVariants}
            className={`backdrop-blur-md bg-gradient-to-br ${cards[3].gradient} bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group`}
          >
            <div className={`mb-4 ${cards[3].color} group-hover:scale-110 transition-transform duration-300`}>{cards[3].icon}</div>
            <FeatureText title={cards[3].title} description={cards[3].description} tags={cards[3].tags} titleSize="text-lg" />
          </motion.div>

          <motion.div
            variants={cardVariants}
            className={`backdrop-blur-md bg-gradient-to-br ${cards[4].gradient} bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group`}
          >
            <div className={`mb-4 ${cards[4].color} group-hover:scale-110 transition-transform duration-300`}>{cards[4].icon}</div>
            <FeatureText title={cards[4].title} description={cards[4].description} tags={cards[4].tags} titleSize="text-lg" />
          </motion.div>

          {/* Row 3: small + small full-width on mobile */}
          <motion.div
            variants={cardVariants}
            className={`backdrop-blur-md bg-gradient-to-br ${cards[5].gradient} bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group`}
          >
            <div className={`mb-4 ${cards[5].color} group-hover:scale-110 transition-transform duration-300`}>{cards[5].icon}</div>
            <FeatureText title={cards[5].title} description={cards[5].description} tags={cards[5].tags} titleSize="text-lg" />
          </motion.div>

          <motion.div
            variants={cardVariants}
            className={`md:col-span-2 backdrop-blur-md bg-gradient-to-br ${cards[6].gradient} bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group`}
          >
            <div className={`mb-4 ${cards[6].color} group-hover:scale-110 transition-transform duration-300`}>{cards[6].icon}</div>
            <FeatureText title={cards[6].title} description={cards[6].description} tags={cards[6].tags} titleSize="text-lg" />
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}
