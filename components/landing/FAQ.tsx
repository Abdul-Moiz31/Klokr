"use client";

import { useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { useRef } from "react";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "How is my data stored?",
    a: "Your data lives in Supabase (PostgreSQL) on AWS, encrypted at rest and in transit. Row-level security means only your account can ever read your data — even we query it the same way you do.",
  },
  {
    q: "What does the extension actually record?",
    a: "Just the domain and page title of tabs you visit, plus start time, end time, and duration. We never capture full URLs, page content, form inputs, passwords, or anything you type — and incognito tabs are never tracked.",
  },
  {
    q: "Do I have to start a timer every day?",
    a: "No. Klokrs tracks passively while you browse. You can set daily tracking hours (e.g. 9am–5pm) in Dashboard Settings, and the extension automatically tracks within that window — nothing to start or stop yourself. The Daily Planner and Pomodoro timer are optional layers on top if you want more structure.",
  },
  {
    q: "Can I use the dashboard without the extension?",
    a: "You can sign in and view the app, but tab time and domain analytics only populate once the Chrome extension is installed and tracking is enabled on the browser you want measured.",
  },
  {
    q: "Is Klokrs really free?",
    a: "Yes — every feature on the Free plan is free today, no credit card required. We're building paid Standard and Pro tiers for extra features like PDF export and API access, but nothing you already use for free will be paywalled, and you'll be notified before anything changes.",
  },
  {
    q: "Which browsers are supported?",
    a: "Klokrs is a Manifest V3 Chrome extension, so it works on Chrome and other Chromium-based browsers (Edge, Brave, Arc). Firefox and Safari support isn't available yet.",
  },
  {
    q: "Does the Ask AI feature cost extra?",
    a: "No — Ask AI is bring-your-own-key. Connect your own OpenAI, Gemini, Anthropic, or OpenRouter API key and ask questions about your tracked data. You're billed by your AI provider directly, not by Klokrs.",
  },
  {
    q: "How do I delete my data or account?",
    a: "Go to Settings — you can pause tracking anytime, export everything as CSV, or permanently delete your account. Deletion is irreversible and fully processed within 30 days.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="faq" className="relative py-24" ref={ref}>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/8 to-transparent pointer-events-none" />
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
