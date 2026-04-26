"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const problems = [
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
        <path d="M7 8h4M7 12h4M15 8h2M15 12h2" />
      </svg>
    ),
    title: "Tabs blur together",
    body: "You open 30 tabs before 10am. By the end of the day you have no idea which ones actually moved the needle and which were just background noise.",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
        <path d="M9.5 3.5L8 2M14.5 3.5L16 2" />
      </svg>
    ),
    title: "No honest data",
    body: "Manual time tracking is a lie you tell yourself. You round up, forget blocks, and skip the embarrassing stuff. The truth lives in your browser tabs.",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "Reports that mean nothing",
    body: "Existing tools show you data about meetings and tasks, but not your actual digital behavior. That's where your real day lives.",
  },
];

export function Problem() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F] via-violet-950/10 to-[#0A0A0F]" />

      <div ref={ref} className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            You end every day not knowing{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              where 8 hours went.
            </span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            The problem isn&apos;t discipline. It&apos;s that you&apos;ve never
            had accurate data about your own digital behavior.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((problem, i) => (
            <motion.div
              key={problem.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/8 hover:border-white/20 transition-all duration-300 group"
            >
              <div className="text-violet-400 mb-5 group-hover:scale-110 transition-transform duration-300">
                {problem.icon}
              </div>
              <h3 className="text-white font-bold text-xl mb-3">
                {problem.title}
              </h3>
              <p className="text-white/50 text-sm leading-relaxed">
                {problem.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
