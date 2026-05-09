"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-violet-400">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ComingSoonModal({ plan, onClose }: { plan: "Standard" | "Pro"; onClose: () => void }) {
  const quote =
    plan === "Standard"
      ? "Good things take time. Great things take a little longer."
      : "The best tools are worth the wait. This one almost is.";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f16] p-8 shadow-2xl shadow-black/70 text-center"
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/10 hover:text-white/70"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Icon */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          <h3 className="mb-2 text-lg font-bold text-white/95">{plan} is coming soon</h3>
          <p className="mb-5 text-sm text-white/45 leading-relaxed">
            Enjoy everything for free while it lasts. Paid plans are being built
            and will launch soon. No surprises, no sudden paywalls.
          </p>

          {/* Quote */}
          <div className="mb-6 rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
            <p className="text-xs italic text-white/35 leading-relaxed">
              &ldquo;{quote}&rdquo;
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.5)]"
          >
            Got it, I&apos;ll keep using it free
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const FREE_FEATURES = [
  "Tab time tracking across all domains",
  "Daily, weekly and monthly reports",
  "Domain drill-down with hourly chart",
  "90-day activity heatmap",
  "Streak and productivity tracking",
  // "Daily Planner with unlimited tasks",    // coming soon
  // "Weekday, Saturday and Sunday templates", // coming soon
  // "Pomodoro timer",                         // coming soon
  "Chrome extension with live popup",
  "CSV data export",
  "Dashboard sync across sessions",
];

const STANDARD_FEATURES = [
  "Everything in Free",
  "PDF report export",
  "Custom day templates (unlimited)",
  "Domain time goals and alerts",
  "Weekly summary email digest",
  "Priority support",
];

const PRO_FEATURES = [
  "Everything in Standard",
  "Unlimited history (Free is 90 days)",
  "Advanced productivity analytics",
  "Custom domain categories and tags",
  "API access for your own integrations",
  "Early access to every new feature",
];

export function Pricing() {
  const [modal, setModal] = useState<"Standard" | "Pro" | null>(null);

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124,58,237,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/80">
            Pricing
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-white/95 sm:text-4xl">
            Simple, honest pricing
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/40">
            Everything is free right now. Paid plans are being built. No sudden
            paywalls, no feature removals. When they launch, you will know in
            advance.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-6 sm:grid-cols-3">

          {/* Free */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7"
          >
            <div className="mb-6">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/35">Free</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="mb-1 text-sm text-white/35">/ month</span>
              </div>
              <p className="mt-2 text-xs text-white/40">No credit card required. No catch.</p>
              <p className="mt-2 text-xs text-white/40">LIMITED TIME OFFER.</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-xs text-white/60">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="block rounded-xl border border-white/10 bg-white/[0.05] py-2.5 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Get started free
            </Link>
          </motion.div>

          {/* Standard */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative flex flex-col rounded-2xl border border-violet-500/40 bg-violet-500/[0.06] p-7 shadow-lg shadow-violet-500/10"
          >
            {/* Popular badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-violet-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                Coming Soon
              </span>
            </div>

            <div className="mb-6">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-violet-400/80">Standard</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-white">$3</span>
                <span className="mb-1 text-sm text-white/35">/ month</span>
              </div>
              <p className="mt-2 text-xs text-white/40">For engineers who want the full picture.</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {STANDARD_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-xs text-white/60">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setModal("Standard")}
              className="block w-full rounded-xl bg-violet-600 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.5)]"
            >
              Get Standard
            </button>
          </motion.div>

          {/* Pro */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7"
          >
            <div className="mb-6">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400/80">Pro</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-white">$8</span>
                <span className="mb-1 text-sm text-white/35">/ month</span>
              </div>
              <p className="mt-2 text-xs text-white/40">For power users and serious builders.</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-xs text-white/60">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setModal("Pro")}
              className="block w-full rounded-xl border border-cyan-500/30 bg-cyan-500/[0.08] py-2.5 text-center text-sm font-semibold text-cyan-400 transition hover:bg-cyan-500/20 hover:text-cyan-300"
            >
              Get Pro
            </button>
          </motion.div>
        </div>

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-white/25">
          All plans include the Chrome extension. Paid plans will be announced via
          email before any free features change.
        </p>
      </div>

      {/* Modal */}
      {modal && (
        <ComingSoonModal plan={modal} onClose={() => setModal(null)} />
      )}
    </section>
  );
}
