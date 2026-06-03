"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { ParticleField } from "./ParticleField";
import { useAuthCta } from "@/lib/useAuthCta";

function DashboardMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 150, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 150, damping: 25 });

  const rotateX = useTransform(springY, [-200, 200], [10, -10]);
  const rotateY = useTransform(springX, [-200, 200], [-10, 10]);

  const handleMouseMove = (e: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fake hourly activity curve (peaks around 10am and 3pm)
  const hours = [0,0,0,0,0,0,2,8,22,45,68,72,55,40,30,62,75,58,35,18,8,3,0,0];
  const maxH = Math.max(...hours);

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="relative w-full max-w-lg mx-auto"
    >
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/20">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="w-3 h-3 rounded-full bg-red-400/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
          <div className="w-3 h-3 rounded-full bg-green-400/70" />
          <span className="ml-2 text-white/40 text-xs">klokrs.app/dashboard</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-semibold text-sm">Good morning, dev</div>
              <div className="text-white/40 text-xs">Wednesday, June 4</div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-emerald-400 text-xs">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Today", value: "5h 14m" },
              { label: "Focus Score", value: "82" },
              { label: "Streak", value: "12d 🔥" },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-white/40 text-[10px]">{s.label}</div>
                <div className="text-white font-bold text-sm mt-1">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Hourly activity area chart */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-xs font-medium">Active hours today</span>
              <span className="text-white/30 text-[10px]">peak 3pm</span>
            </div>
            <div className="flex items-end gap-0.5 h-14">
              {hours.map((v, i) => {
                const pct = maxH > 0 ? (v / maxH) * 100 : 0;
                const isNow = i === 15;
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end">
                    <div
                      className={`w-full rounded-sm transition-all ${isNow ? "bg-cyan-400/70" : "bg-violet-500/40"}`}
                      style={{ height: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-white/20">
              <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
            </div>
          </div>

          {/* Top sites */}
          <div className="space-y-2">
            {[
              { domain: "github.com",    pct: 85, color: "from-violet-500 to-violet-400" },
              { domain: "figma.com",     pct: 58, color: "from-cyan-500 to-cyan-400" },
              { domain: "claude.ai",     pct: 42, color: "from-violet-500/80 to-cyan-500/70" },
              { domain: "notion.so",     pct: 24, color: "from-violet-600/70 to-cyan-600/60" },
            ].map((item) => (
              <div key={item.domain} className="flex items-center gap-2.5">
                <div className="text-white/50 text-[11px] w-20 truncate">{item.domain}</div>
                <div className="flex-1 bg-white/[0.06] rounded-full h-1.5">
                  <div className={`bg-gradient-to-r ${item.color} h-1.5 rounded-full`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Glow */}
      <div className="absolute -inset-4 bg-violet-500/10 rounded-3xl blur-xl -z-10" />
    </motion.div>
  );
}

export function Hero() {
  const ctaHref = useAuthCta();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Particle background */}
      <div className="absolute inset-0 z-0">
        <ParticleField />
      </div>

      {/* Cursor glow */}
      <div
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(124,58,237,0.06), transparent 60%)`,
        }}
      />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F]/50 via-transparent to-[#0A0A0F] z-[1]" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-20 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-sm font-medium mb-6">
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                Built for focused builders
              </span>

              <h1 className="text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Know exactly{" "}
                <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  where your time goes
                </span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-white/60 text-xl leading-relaxed"
            >
              Automatic tab tracking, an analytics dashboard, a daily planner, and AI you can ask anything — all in one accountability tool that never lies about your day.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
            >
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 cursor-pointer bg-violet-600 hover:bg-violet-500 text-white hover:shadow-[0_0_25px_rgba(124,58,237,0.6)] px-8 py-4 text-lg"
              >
                Get Started Free
              </Link>
              <a
                href="https://chromewebstore.google.com/detail/klokrs-tab-time-tracker/blmfhmebeklbekobmamhidobkafpnnfg"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 font-medium rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25 text-white/80 hover:text-white transition-all duration-300 px-6 py-4 text-base"
              >
                {/* Chrome logo */}
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="4.5" fill="white" fillOpacity="0.9" />
                  <path d="M12 7.5h9.18A10.5 10.5 0 0 0 2.93 6.27L7.42 14a4.5 4.5 0 0 1 4.58-6.5z" fill="#4285F4" />
                  <path d="M12 16.5a4.5 4.5 0 0 1-3.9-2.25L3.6 6.4A10.5 10.5 0 0 0 12 22.5a10.45 10.45 0 0 0 9.18-5.4L16.5 9a4.5 4.5 0 0 1-4.5 7.5z" fill="#34A853" />
                  <path d="M16.5 9H7.42a4.5 4.5 0 0 0-.32.5L2.6 17.55A10.5 10.5 0 0 0 21.18 7.5H12" fill="#FBBC05" />
                </svg>
                Add to Chrome
              </a>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.38 }}
              className="text-white/35 text-sm"
            >
              Free · No credit card required · Works instantly after install
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center gap-6 pt-4"
            >
              {[
                { label: "Users tracking", value: "2,000+" },
                { label: "Features shipped", value: "20+" },
                { label: "Domains tracked", value: "50k+" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-white font-bold text-lg">
                    {stat.value}
                  </div>
                  <div className="text-white/40 text-xs">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="hidden lg:block"
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
