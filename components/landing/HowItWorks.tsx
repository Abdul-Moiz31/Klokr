"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const steps = [
  {
    number: "01",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="14" cy="14" r="12" />
        <path d="M9 14l4 4 6-7" />
      </svg>
    ),
    title: "Install the Chrome extension",
    description:
      "One click from the Chrome Web Store. No sign-in required to start. It begins watching immediately.",
  },
  {
    number: "02",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="4" width="20" height="16" rx="2" />
        <path d="M9 10h10M9 14h6" />
        <circle cx="20" cy="20" r="4" fill="none" />
        <path d="M20 18v2l1 1" />
      </svg>
    ),
    title: "Work normally. It tracks in the background.",
    description:
      "No timers to start. No tasks to log. Klokr silently records every tab, every domain, every second — including when you're idle.",
  },
  {
    number: "03",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20l6-8 4 5 4-6 6 9" />
        <rect x="4" y="4" width="20" height="18" rx="2" />
      </svg>
    ),
    title: "Open your dashboard. See everything.",
    description:
      "A clean, honest breakdown of your day. Every domain, every minute, presented so clearly you'll immediately know what to change.",
  },
];

export function HowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="how-it-works" className="py-24">
      <div ref={ref} className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-violet-400 font-semibold text-sm tracking-widest uppercase mb-4 block">
            How It Works
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold">
            Three steps to{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              clarity
            </span>
          </h2>
        </motion.div>

        <p className="text-center text-white/45 text-base max-w-2xl mx-auto mb-12">
          From install to insight—no ceremony, no fake precision. Just the story of
          your day, pulled straight from the browser.
        </p>

        <div className="relative max-w-5xl mx-auto">
          {/* desktop: three columns with a connector line through the icons */}
          <div className="hidden md:block">
            <div className="relative">
              <div
                className="absolute top-8 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-violet-500/45 via-cyan-500/35 to-cyan-500/45 rounded-full pointer-events-none"
                aria-hidden
              />
              <div className="grid grid-cols-3 gap-8 text-center">
                {steps.map((step, i) => (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, y: 32 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.55, delay: i * 0.12 }}
                    className="relative z-10 flex flex-col items-center"
                  >
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/35 bg-[#0A0A0F] shadow-lg shadow-violet-900/30 text-violet-400">
                      {step.icon}
                    </div>
                    <p className="text-violet-500/60 font-mono text-xs font-semibold tracking-widest mb-2">
                      STEP {step.number}
                    </p>
                    <h3 className="text-white font-bold text-lg mb-3 leading-snug max-w-xs">
                      {step.title}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed max-w-sm">
                      {step.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* mobile: vertical stack */}
          <div className="md:hidden space-y-10">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -16 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/20 to-cyan-600/20 border border-violet-500/30 text-violet-400">
                    {step.icon}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 min-h-[1.5rem] bg-gradient-to-b from-violet-500/40 to-cyan-500/30" />
                  )}
                </div>
                <div className="pb-2">
                  <p className="text-violet-500/60 font-mono text-xs font-semibold tracking-widest mb-1">
                    STEP {step.number}
                  </p>
                  <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
