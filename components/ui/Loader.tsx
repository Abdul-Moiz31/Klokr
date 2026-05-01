"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PRODUCT_QUOTES } from "@/lib/productQuotes";

// ─── Animated clock SVG — hands use SMIL rotate(θ 0 0) after translate(cx,cy)
// so the pivot is always the clock center (Framer rotate on <g> misaligns).

function ClockFace({ size = 80 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;

  const round = (n: number) => Math.round(n * 10000) / 10000;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const rad = (i * 30 * Math.PI) / 180;
    const isMaj = i % 3 === 0;
    const outer = r - 1;
    const inner = outer - (isMaj ? size * 0.09 : size * 0.05);
    return {
      x1: round(cx + outer * Math.sin(rad)),
      y1: round(cy - outer * Math.cos(rad)),
      x2: round(cx + inner * Math.sin(rad)),
      y2: round(cy - inner * Math.cos(rad)),
      isMaj,
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1.5"
      />

      <circle
        cx={cx}
        cy={cy}
        r={r * 0.88}
        fill="none"
        stroke="rgba(124,58,237,0.12)"
        strokeWidth="0.75"
      />

      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.isMaj ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)"}
          strokeWidth={t.isMaj ? 1.5 : 1}
          strokeLinecap="round"
        />
      ))}

      <g transform={`translate(${cx}, ${cy})`}>
        {/* Hour — slow */}
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 0 0"
            to="360 0 0"
            dur="12s"
            repeatCount="indefinite"
          />
          <line
            x1={0}
            y1={size * 0.06}
            x2={0}
            y2={-r * 0.48}
            stroke="rgba(255,255,255,0.92)"
            strokeWidth={size / 18}
            strokeLinecap="round"
          />
        </g>
        {/* Minute — purple */}
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 0 0"
            to="360 0 0"
            dur="3s"
            repeatCount="indefinite"
          />
          <line
            x1={0}
            y1={size * 0.08}
            x2={0}
            y2={-r * 0.7}
            stroke="#7C3AED"
            strokeWidth={size / 26}
            strokeLinecap="round"
          />
        </g>
        {/* Second — cyan */}
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 0 0"
            to="360 0 0"
            dur="0.75s"
            repeatCount="indefinite"
          />
          <line
            x1={0}
            y1={size * 0.12}
            x2={0}
            y2={-r * 0.82}
            stroke="#06B6D4"
            strokeWidth={Math.max(1, size / 55)}
            strokeLinecap="round"
          />
        </g>
      </g>

      <circle cx={cx} cy={cy} r={size / 14} fill="#7C3AED" />
      <circle cx={cx} cy={cy} r={size / 28} fill="white" />
    </svg>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface LoaderProps {
  /** Tailwind classes for the outer wrapper */
  className?: string;
  clockSize?: number;
  /** Full-page splash: centered, no extra vertical padding */
  variant?: "default" | "splash";
}

export function Loader({ className = "", clockSize = 80, variant = "default" }: LoaderProps) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setIdx(Math.floor(Math.random() * PRODUCT_QUOTES.length));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % PRODUCT_QUOTES.length);
        setVisible(true);
      }, 350);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const wrap =
    variant === "splash"
      ? "flex flex-col items-center justify-center gap-5 min-h-0 select-none"
      : "flex flex-col items-center justify-center gap-5 py-20 select-none";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`${wrap} ${className}`}
    >
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)",
            transform: "scale(1.8)",
          }}
        />
        <motion.div
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative"
        >
          <ClockFace size={clockSize} />
        </motion.div>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.22em] bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
        Klokrs
      </p>

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
              &ldquo;{PRODUCT_QUOTES[idx]}&rdquo;
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
