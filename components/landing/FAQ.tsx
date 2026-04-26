"use client";

import { useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { useRef } from "react";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "How is my data stored?",
    a: "We use Supabase (PostgreSQL) for authenticated sessions. Tab sessions are associated with your account. Use a strong password and keep your session private on shared machines.",
  },
  {
    q: "What does the extension actually record?",
    a: "It tracks time spent on active browser tabs, domains, visit patterns, and titles—so the dashboard can show where your day went. You control install and can sign out at any time.",
  },
  {
    q: "Do I have to start a timer every day?",
    a: "No. Tably is designed for passive tracking while you work. The daily planner and Pomodoro are optional layers on top if you want structure.",
  },
  {
    q: "Can I use the dashboard without the extension?",
    a: "You can sign in and use the app, but tab time and domain analytics require the Chrome extension to send session data from the browser you want measured.",
  },
  {
    q: "What if I delete my account or stop using Tably?",
    a: "You can sign out and stop the extension. For account or data questions, use your app settings and provider policies (Supabase) as we wire them in over time.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="faq" className="relative py-24" ref={ref}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F] via-violet-950/10 to-[#0A0A0F] pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="text-violet-400 font-semibold text-sm tracking-widest uppercase mb-4 block">
            FAQ
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">
            Common{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              questions
            </span>
          </h2>
        </motion.div>

        <ul className="space-y-2">
          {ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.li
                key={item.q}
                initial={{ opacity: 0, y: 12 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-white font-medium hover:bg-white/5 transition-colors"
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <span
                    className={`shrink-0 text-violet-400/80 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <p className="px-5 pb-4 pt-3 text-sm text-white/55 leading-relaxed">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
