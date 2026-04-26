"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InfoTooltipProps {
  text: string;
  /** Which side the tooltip floats toward. Defaults to "top". */
  side?: "top" | "bottom";
}

export function InfoTooltip({ text, side = "top" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isTop = side === "top";

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full text-white/25 transition-colors hover:text-white/55 focus:outline-none"
        aria-label="More information"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: isTop ? 4 : -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isTop ? 4 : -4, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            className={`pointer-events-none absolute left-1/2 z-50 w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-[#16162a] px-3 py-2.5 shadow-xl shadow-black/50 ${
              isTop ? "bottom-6" : "top-6"
            }`}
          >
            <p className="text-[11px] leading-relaxed text-white/55">{text}</p>
            {/* Caret */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 h-2.5 w-2.5 rotate-45 rounded-sm border border-white/10 bg-[#16162a] ${
                isTop
                  ? "-bottom-1.5 border-t-transparent border-l-transparent"
                  : "-top-1.5 border-b-transparent border-r-transparent"
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
