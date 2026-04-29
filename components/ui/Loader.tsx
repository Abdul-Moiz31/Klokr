"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const QUOTES = [
  "Track today. Own tomorrow.",
  "Every minute tells a story.",
  "What gets tracked gets improved.",
  "Focus compounds over time.",
  "One tab at a time.",
  "Your time, your insight.",
  "Small hours. Big results.",
  "Awareness is the first step.",
  "Great days are built minute by minute.",
  "You can't improve what you don't measure.",
];

// ─── Animated clock SVG ───────────────────────────────────────────────────────

function ClockFace({ size = 80 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 3;

  // 12 tick marks — major at 3/6/9/12
  // Round to 4 dp to prevent server/client floating-point divergence.
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const rad    = (i * 30 * Math.PI) / 180;
    const isMaj  = i % 3 === 0;
    const outer  = r - 1;
    const inner  = outer - (isMaj ? size * 0.09 : size * 0.05);
    return {
      x1: round(cx + outer * Math.sin(rad)),
      y1: round(cy - outer * Math.cos(rad)),
      x2: round(cx + inner * Math.sin(rad)),
      y2: round(cy - inner * Math.cos(rad)),
      isMaj,
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      {/* Outer ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1.5"
      />

      {/* Inner second ring */}
      <circle
        cx={cx} cy={cy} r={r * 0.88}
        fill="none"
        stroke="rgba(124,58,237,0.12)"
        strokeWidth="0.75"
      />

      {/* Tick marks */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={t.isMaj ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)"}
          strokeWidth={t.isMaj ? 1.5 : 1}
          strokeLinecap="round"
        />
      ))}

      {/* Hour hand — slow (12 s / revolution for visual effect) */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <line
          x1={cx} y1={cy + size * 0.06}
          x2={cx} y2={cy - r * 0.48}
          stroke="rgba(255,255,255,0.92)"
          strokeWidth={size / 18}
          strokeLinecap="round"
        />
      </motion.g>

      {/* Minute hand — medium (3 s / revolution) */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <line
          x1={cx} y1={cy + size * 0.08}
          x2={cx} y2={cy - r * 0.70}
          stroke="#7C3AED"
          strokeWidth={size / 26}
          strokeLinecap="round"
        />
      </motion.g>

      {/* Second hand — fast (0.75 s / revolution) */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <line
          x1={cx} y1={cy + size * 0.12}
          x2={cx} y2={cy - r * 0.82}
          stroke="#06B6D4"
          strokeWidth={Math.max(1, size / 55)}
          strokeLinecap="round"
        />
      </motion.g>

      {/* Centre cap */}
      <circle cx={cx} cy={cy} r={size / 14} fill="#7C3AED" />
      <circle cx={cx} cy={cy} r={size / 28} fill="white"   />
    </svg>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface LoaderProps {
  /** Tailwind classes for the outer wrapper — use to control vertical padding */
  className?: string;
  /** Clock diameter in px */
  clockSize?: number;
}

export function Loader({ className = "", clockSize = 80 }: LoaderProps) {
  // Start at 0 (deterministic for SSR), randomise after first paint.
  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setIdx(Math.floor(Math.random() * QUOTES.length));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % QUOTES.length);
        setVisible(true);
      }, 350);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center gap-5 py-20 select-none ${className}`}
    >
      {/* Clock + glow */}
      <div className="relative">
        {/* Ambient glow rings */}
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)",
            transform: "scale(1.8)",
          }}
        />
        <motion.div
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1,    opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative"
        >
          <ClockFace size={clockSize} />
        </motion.div>
      </div>

      {/* Brand wordmark */}
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
        Klokrs
      </p>

      {/* Cycling productivity quote */}
      <div className="h-5 flex items-center">
        <AnimatePresence mode="wait">
          {visible && (
            <motion.p
              key={idx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.28 }}
              className="text-xs text-white/30 italic text-center px-4"
            >
              &ldquo;{QUOTES[idx]}&rdquo;
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
