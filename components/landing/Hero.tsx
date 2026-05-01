"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { ParticleField } from "./ParticleField";

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
          <span className="ml-2 text-white/40 text-xs">Klokrs.app/dashboard</span>
        </div>

        {/* Mock dashboard content */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-semibold text-sm">
                Good morning, dev
              </div>
              <div className="text-white/40 text-xs">Friday, April 25</div>
            </div>
            <div className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs">
              ● Tracking
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Time Today", value: "6h 42m" },
              { label: "Domains", value: "14" },
              { label: "Top Site", value: "github.com" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white/5 rounded-xl p-3 border border-white/10"
              >
                <div className="text-white/40 text-xs">{stat.label}</div>
                <div className="text-white font-bold text-sm mt-1 truncate">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Mini bar chart */}
          <div className="space-y-2">
            {[
              { domain: "github.com", pct: 85, color: "bg-violet-500" },
              { domain: "localhost:3000", pct: 60, color: "bg-cyan-500" },
              { domain: "figma.com", pct: 40, color: "bg-violet-400" },
              { domain: "notion.so", pct: 25, color: "bg-cyan-400" },
            ].map((item) => (
              <div key={item.domain} className="flex items-center gap-3">
                <div className="text-white/50 text-xs w-24 truncate">
                  {item.domain}
                </div>
                <div className="flex-1 bg-white/5 rounded-full h-1.5">
                  <div
                    className={`${item.color} h-1.5 rounded-full`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Glow effect */}
      <div className="absolute -inset-4 bg-violet-500/10 rounded-3xl blur-xl -z-10" />
    </motion.div>
  );
}

export function Hero() {
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
                Built for software engineers
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
              A silent tab tracker built for engineers who want honest data
              about their day. Install the extension, work normally, see
              everything.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
            >
              <Link
                href="/signup"
                className="inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 cursor-pointer bg-violet-600 hover:bg-violet-500 text-white hover:shadow-[0_0_25px_rgba(124,58,237,0.6)] px-8 py-4 text-lg"
              >
                Get Started Free
              </Link>
              <p className="text-white/40 text-sm">
                No credit card required. No setup needed.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center gap-6 pt-4"
            >
              {[
                { label: "Engineers tracking", value: "2,000+" },
                { label: "Avg time recovered", value: "1.5h/day" },
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
