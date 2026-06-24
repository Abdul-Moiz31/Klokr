"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ParticleField } from "./ParticleField";
import { useAuthCta } from "@/lib/useAuthCta";
import { buttonClasses, ButtonArrowIcon } from "@/components/ui/Button";

const ease = [0.22, 1, 0.36, 1] as const;

const textContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 32, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.75, ease },
  },
};

const marqueeFeatures = [
  "Productivity",
  "Time Tracking",
  "Focus Score",
  "Daily Planner",
  "AI Insights",
  "Tab Tracking",
  "Analytics",
  "Pomodoro",
];

function LogoMarquee() {
  const items = [...marqueeFeatures, ...marqueeFeatures, ...marqueeFeatures];
  return (
    <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className="flex w-max animate-marquee items-center gap-14 md:gap-20 py-2">
        {items.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="shrink-0 select-none whitespace-nowrap text-base font-semibold uppercase tracking-[0.18em] text-white/20 md:text-lg"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function PostHeroDashboard({ scrollProgress }: { scrollProgress: MotionValue<number> }) {
  const y = useTransform(scrollProgress, [0, 1], [0, -48]);
  const scale = useTransform(scrollProgress, [0, 0.55], [1, 0.97]);

  return (
    <div className="relative mx-auto mt-7 w-full max-w-[1024px] md:mt-9">
      <motion.div style={{ y, scale }} className="relative will-change-transform">
        {/* Nexaro-style appear: rises in after hero copy, on page load */}
        <motion.div
          initial={{ opacity: 0, y: 72, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease, delay: 0.48 }}
          className="relative"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease, delay: 0.55 }}
            className="pointer-events-none absolute -left-12 -top-16 h-[70%] w-[55%] rounded-full bg-violet-600/35 blur-[70px]"
          />
          <div className="pointer-events-none absolute -top-8 left-[10%] h-[50%] w-[45%] rounded-full bg-indigo-500/20 blur-[50px]" />
          <div className="pointer-events-none absolute -inset-[1px] rounded-[20px] bg-gradient-to-b from-violet-500/25 via-white/5 to-transparent" />

          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.6 }}
            className="relative overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#0B0B12] shadow-[0_32px_100px_rgba(88,28,135,0.45),0_0_0_1px_rgba(255,255,255,0.04)_inset] max-h-[min(62vh,680px)] md:max-h-[720px]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />
            <Image
              src="/landing/dashboard-screenshot.png"
              alt="Klokrs dashboard showing accountability score, focus score, activity heatmap, and plan vs actual tracking"
              width={3012}
              height={1716}
              className="block h-auto w-full"
              priority
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-[#0B0B12] to-transparent" />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function Hero() {
  const ctaHref = useAuthCta();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const sectionRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    const handleMouse = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    el.addEventListener("mousemove", handleMouse);
    return () => el.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden rounded-b-[20px]">
      <div
        ref={heroRef}
        className="absolute inset-0 z-0 [mask-image:linear-gradient(to_bottom,black_15%,black_50%,transparent_88%)]"
      >
        <ParticleField />
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(380px circle at ${mousePos.x}px ${mousePos.y}px, rgba(124,58,237,0.07), transparent 65%)`,
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-4xl pt-28 text-center md:pt-32">
          <motion.div variants={textContainer} initial="hidden" animate="show">
            <motion.span
              variants={fadeUp}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-400"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
              Built for focused builders
            </motion.span>

            <motion.h1
              variants={fadeUp}
              className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
            >
              Know exactly{" "}
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                where your time goes
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl"
            >
              Automatic tab tracking, an analytics dashboard, a daily planner, and AI you can ask anything — all in one accountability tool that never lies about your day.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Link href={ctaHref} className={buttonClasses("primary", "md")}>
                <ButtonArrowIcon />
                Get Started Free
              </Link>
              <a href="#features" className={buttonClasses("secondary", "md")}>
                Our Features
              </a>
            </motion.div>

            <motion.p variants={fadeUp} className="mt-4 text-sm text-white/35">
              Free · No credit card required · Works instantly after install
            </motion.p>
          </motion.div>
        </div>

        <PostHeroDashboard scrollProgress={scrollYProgress} />

        {/* Trust strip — follows dashboard in the Nexaro load sequence */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease, delay: 0.92 }}
          className="relative z-20 flex flex-col items-center pb-16 pt-6 md:pb-20 md:pt-8"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease, delay: 1.02 }}
            className="mb-7 text-sm tracking-wide text-white/40"
          >
            Trusted by 1000+ customers
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 1.1 }}
            className="w-full max-w-4xl"
          >
            <LogoMarquee />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
